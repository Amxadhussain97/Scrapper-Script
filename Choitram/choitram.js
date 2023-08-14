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
      await page.goto("https://www.choithrams.com/en/special-offers/");

      let data = [];

      await page.evaluate(() => {
        const y = document.body.scrollHeight / 2;
        window.scrollTo(0, y);
      });

      // Wait for 2 seconds for the page to scroll to the middle
      // await page.waitFor(2000);

      // give wait for selector
      await page.waitForSelector(
        "#default > section.sticky-category.scrolled > div > div > div.swiper-wrapper",
        {
          timeout: 900000,
        }
      );

      let categories = await page.$$eval(
        "#default > section.sticky-category.scrolled > div > div > div.swiper-wrapper > a",
        (items) => {
          return items.map((item) => {
            return {
              name: item.innerText,
              link: `https://www.choithrams.com${item.getAttribute("href")}`,
            };
          });
        }
      );

      categories.shift();

      // goto each items link
      for (let i = 0; i < categories.length; i++) {
        // console.log("test--- ", categories[i]["link"]);

        await page.goto(categories[i]["link"], {
          waitUntil: "load",
          timeout: 900000,
        });

        let products = await page.$$eval(
          "#default > main > section.products-list > div > div.row > div",
          (items) => {
            return items.map((pr) => {
              return {
                image_url: pr.querySelector(
                  "div > div.product-container > div.product-img > a > img"
                )?.src,
                name: pr.querySelector(
                  "div > div.product-container > div.product-img > a > img"
                )?.alt,
                link: pr.querySelector(
                  "div > div.product-container > div.product-img > a"
                )?.href,

                currency: pr.querySelector(
                  " div > div.product-container > div.product-info > div.left > div:nth-child(1) > p.price > sup"
                )?.innerText,
                current_price: pr
                  .querySelector(
                    "div > div.product-container > div.product-info > div.left > div.product-price.mobile > p.price"
                  )
                  ?.innerText?.match(/\d+\.\d+/)[0],
                old_price: pr
                  .querySelector(
                    "div > div.product-container > div.product-info > div.left > div.product-price.mobile > p.currency"
                  )
                  ?.innerText?.match(/\d+\.\d+/)[0],
                // get float value from present_price
              };
            });
          }
        );

        // go each product link
        // for (let j = 0; j < products.length; j++) {
        //   await page.goto(products[j]["link"], {
        //     waitUntil: "load",
        //     timeout: 900000,
        //   });

        //   // get product details

        // }

        categories[i]["products"] = products;
      }

      items = {
        url: "https://choitram.com",
        name: "choitram",
        categories: categories,
      };

      fs.writeFileSync("choitram.json", JSON.stringify(items));

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
          fs.appendFileSync("choitram-error.log", e + "\n");
        });

      await browser.close();
      return resolve();
    } catch (e) {
      console.log("errror --------- ", e);
      fs.appendFileSync("choitram-error.log", e + "\n");
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
