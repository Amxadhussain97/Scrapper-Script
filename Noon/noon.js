const puppeteer = require("puppeteer");
const fs = require("fs");
const axios = require("axios");

function run() {
  return new Promise(async (resolve, reject) => {
    try {
      const browser = await puppeteer.launch({
        headless: true,
        defaultViewport: false,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();
      await page.goto("https://www.noon.com/", {
        waitUntil: "networkidle2",
        timeout: 80000,
      });

      let previousHeight = 0;
      let currentHeight = await page.evaluate(() => document.body.scrollHeight);

      const scrollHeight = await page.evaluate(
        () => document.body.scrollHeight
      );

      // Set the scroll step size and the initial position
      const scrollStep = 100;
      let currentPosition = 0;

      // Loop until the entire page has been scrolled
      while (currentPosition < scrollHeight) {
        // Calculate the next scroll position
        const nextPosition = currentPosition + scrollStep;

        // Scroll to the next position
        await page.evaluate((nextPosition) => {
          window.scrollTo(0, nextPosition);
        }, nextPosition);

        // Wait for a short time before scrolling again
        await page.waitForTimeout(350);

        // Update the current position
        currentPosition = nextPosition;
      }

     

      let categories = await page.evaluate(async () => {
        let items = await Array.from(
          document.querySelectorAll(
            "#__next > div > section > div.sc-papXJ.gHpQDD > div > div"
          )
        );
        let data = [];

        items.forEach(async (item) => {
          let slides = Array.from(
            item.querySelectorAll("div.swiper-slide")
          )?.map((link) => link.querySelector("a").href);
          let name = await item.querySelector(".titleHeader").innerText;

          data.push({
            name,
            slides,
          });
        });
        return data;
      });

      // filter caltegories which has name
      categories = await categories.filter((category) => category?.name);

      let cnt = 0;
      for (let i = 0; i < categories.length; i++) {
        console.log("category: ", categories[i]);
        categories[i].products = [];
        for (let j = 0; j < categories[i].slides.length; j++) {
          console.log("test-- ", categories[i].slides[j]);
          try {
            await page.goto(categories[i].slides[j], {
              waitUntil: "networkidle2",
              timeout: 80000,
            });
          } catch (err) {
            console.log("--err", err);
            continue;
          }

          let product = await page.evaluate(() => {
            let name = document.querySelector(
              "#__next > div > section > div > div:nth-child(1) > div > div.sc-f399edf3-6.bCSRnD > div.sc-f399edf3-7.gjsKnK > div.sc-68c2de00-2.iSmTCx > h1"
            )?.innerText;

            let price = document.querySelector("div.priceNow")?.innerText;
            let old_price = document.querySelector("div.priceWas")?.innerText;

            let offer = document.querySelector("div.profit")?.innerText;

            let description =
              document.querySelector("div.modelNumber")?.innerText;

            let rated = document.querySelector(
              "#__next > div > section > div > div:nth-child(1) > div > div.sc-f399edf3-6.bCSRnD > div.sc-f399edf3-7.gjsKnK > div.sc-68c2de00-2.iSmTCx > div.sc-68c2de00-9.kLafZ > div.sc-68c2de00-10.iAOfl > div > div > div.sc-68c2de00-11.bjstBU > a > div > div.sc-e568c3b8-0.kCxoGQ > span"
            )?.innerText;

            let image_url = document.querySelector(
              "#__next > div > section > div > div:nth-child(1) > div > div.sc-f399edf3-6.bCSRnD > div.sc-f399edf3-7.gjsKnK > div.sc-f399edf3-8.hYHqXx > div > div.sc-cd4806d2-4.fsKWQv > div > div > div.swiper-slide.swiper-slide-active > div > div > div > div > div > div.lazyload-wrapper > div > img"
            )?.src;

            return {
              name,
              current_price: price
                ? parseFloat(price.match(/\d+\.\d+/)[0])
                : "",
              old_price: old_price
                ? parseFloat(old_price.match(/\d+\.\d+/)[0])
                : "",
              currency: "AED",
              offer,
              images: [
                {
                  image_url: image_url,
                },
              ],
              rating: rated,
              summaries: [
                {
                  description: description,
                },
              ],
            };
          });

          categories[i].products.push(product);
        }
     
      }

      // console.log("data ", categories);

      fs.writeFileSync("noon.json", JSON.stringify(categories));

      items = {
        url: "https://noon.com",
        name: "noon",
        categories: categories,
      };

      // let baseUrl = "http://127.0.0.1:8000";
      let baseUrl = "http://34.125.248.160";
      axios
        .post(`${baseUrl}/api/site-data`, items, [
          {
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          },
        ])
        .then((response) => {
          console.log("response holo ", response);
        })
        .catch((e) => {
          fs.appendFileSync("lulu-error.log", e + "\n");
        });

      await browser.close();
      return resolve();
    } catch (e) {
      console.log("errror --------- ", e);
      fs.appendFileSync("noon-error.log", e + "\n");
      return reject(e);
    }
  });
}
run();

// PM2 COMMANDS
// pm2 start index.js --cron "*/3 * * * *"  ----- TO MAKE 3 min cron
// PM2 PS - TO VIEW CRONS
// PM2 DELETE APPID
// pm2 start lulu.js --cron "0 0 * * *" //to run every 24 hour
// pm2 start ./lulu.js --no-autorestart --cron "0 0 * * *" --name "My lulu cron job-24h"
