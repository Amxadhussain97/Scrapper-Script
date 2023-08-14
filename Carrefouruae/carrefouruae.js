const puppeteer = require("puppeteer");
const fs = require("fs");
const axios = require("axios");

function run() {
  return new Promise(async (resolve, reject) => {
    try {
      let browser = await puppeteer.launch({
        headless: false,
        defaultViewport: false,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      let page = await browser.newPage();
      await page.goto(
        "https://www.carrefouruae.com/mafuae/en/n/c/clp_online-deals-promotion"
      );

      console.log("started");
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
            "#__next > div.css-qo9h12 > div.css-4jlmt > div > div"
          )
        );
        let data = [];

        items.forEach(async (item) => {
          let name = await item.querySelector("div > div > div > div > div > p")
            .innerText;
          let values = await Array.from(
            item.querySelectorAll(
              "div > div > div > div > div > div > div > div > div > div"
            )
          );

          let products = [];

          values.forEach(async (value) => {
            let name = await value.querySelector(
              "div > ul > div.css-yqd9tx > div.css-11qbfb > div.css-1nhiovu > a"
            ).innerText;
            let link = await value.querySelector(
              "div > ul > div.css-yqd9tx > div.css-11qbfb > div.css-1nhiovu > a"
            ).href;

            products.push({
              name,
              link,
            });
          });

          // console.log("filter ",filteredData);

          data.push({
            name,
            products: products,
          });
        });
        ``;

        return data;
      });


      // close the browser
      await browser.close();


       browser = await puppeteer.launch({
        headless: true,
        defaultViewport: false,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

       page = await browser.newPage();

      for (let i = 0; i < categories?.length; i++) {
        let products = categories[i]?.products;

        products = await products.filter(
          (item, index, self) =>
            index === self.findIndex((t) => t.link == item.link)
        );

        // make a foreach loop in products array
        for (let j = 0; j < products?.length; j++) {
          let link = products[j]?.link;

          console.log("link ", link);
          // goto the link
          try {
            await page.goto(link, {
              waitUntil: ["networkidle2"],
              timeout: 80000,
            });
          } catch (e) {
            console.log("error---::: ", e);
            continue;
          }
          // #__next > div.css-qo9h12 > main > div > div.css-1cvrzon > div.css-q7lfpb > section.css-1qdzhwi > div.css-1npift7 > ul > li:nth-child(1)
          let image_url = "";

          let images = await page.$$eval(
            "#__next > div.css-qo9h12 > main > div > div.css-1cvrzon > div.css-1spgxsy > section > div > div.swiper-container.css-e5c1kf.swiper-container-initialized.swiper-container-horizontal.swiper-container-pointer-events.swiper-container-free-mode > div > a.swiper-slide.css-2k1izz.swiper-slide-visible.swiper-slide-active > div.css-1c2pck7 > div > img",
            (items) => {
              return items.map((item) => {
                return {
                  image_url: item?.src,
                };
              });
            }
          );

          let offer = "",
            price = "",
            data;
          try {
            data = await page.$$eval(
              "#__next > div.css-qo9h12 > main > div > div.css-1cvrzon > div.css-q7lfpb > div > div > span",
              (items) => {
                return items.map((item) => {
                  return item?.innerText;
                });
              }
            );

            if (data?.length) {
              offer = data[0];
            }

            data = await page.$$eval(
              "#__next > div.css-qo9h12 > main > div > div.css-1cvrzon > div.css-q7lfpb > section.css-168eikn > div.css-1oh8fze > h2",
              (items) => {
                return items.map((item) => {
                  return item?.innerText;
                });
              }
            );

            if (data?.length) {
              price = data[0];
            }
          } catch (e) {
            console.log("errror --------- ", e);
            fs.appendFileSync("carrefouruae-error.log", e + "\n");
          }

          // let current_price = await page.$(
          //   "#__next > div.css-qo9h12 > main > div > div.css-1cvrzon > div.css-q7lfpb > section.css-168eikn > div.css-1oh8fze > h2"
          // ).textContent;

          // let summaries = await Array.from(
          //   page.querySelectorAll("#__next > div.css-qo9h12 > main > div > div.css-1cvrzon > div.css-q7lfpb > section.css-1qdzhwi > div.css-1npift7 > ul > li")
          // ).map((item) => {
          //   return {
          //     description: item?.textContent,
          //   };
          // });

          let summaries = await page.$$eval(
            "#__next > div.css-qo9h12 > main > div > div.css-1cvrzon > div.css-q7lfpb > section.css-1qdzhwi > div.css-1npift7 > ul > li",
            (items) => {
              return items.map((item) => {
                return {
                  description: item?.textContent,
                };
              });
            }
          );

          // Extract currency code using regex
          const currency = price ? price.match(/[A-Z]{3}/)[0] : ""; // Output: "AED"

          // Extract float value using regex
          const current_price = price
            ? parseFloat(price.match(/\d+\.\d+/)[0])
            : ""; // Output: 4.24

          products[j].current_price = current_price;
          products[j].currency = currency;
          products[j].summaries = summaries;
          products[j].images = images;
          products[j].offer = offer;
        }

        categories[i].products = products;
      }

      items = {
        url: "https://carrefouruae.com",
        name: "carrefouruae",
        categories: categories,
      };

      fs.writeFileSync("carrefouruae.json", JSON.stringify(items));

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
          fs.appendFileSync("carrefouruae-error.log", e + "\n");
        });

      //

      await browser.close();
      return resolve();
    } catch (e) {
      console.log("errror --------- ", e);
      fs.appendFileSync("carrefouruae-error.log", e + "\n");
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
