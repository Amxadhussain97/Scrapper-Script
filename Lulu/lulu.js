const puppeteer = require("puppeteer");
const fs = require("fs");
const axios = require("axios");

function lulu() {
  return new Promise(async (resolve, reject) => {
    try {
      const browser = await puppeteer.launch({
        headless: true,
        defaultViewport: false,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();
      await page.goto("https://www.luluhypermarket.com/en-ae/deals");

      let data = [];

      let items = await page.$$eval(
        ".common-tile-section.with-gray-background.section-padding.carousel-product-div.carousel-product-sec",
        (items) =>
          items.map((item) => {
            let products = item.querySelectorAll(".product-desc > h3 > a");
            let links = [];
            products.forEach((product) => {
              links.push(
                `https://www.luluhypermarket.com/${product.getAttribute(
                  "href"
                )}`
              );
            });

            return {
              name: item.querySelector(".section-title")?.innerText,
              links: links,
            };
          })
      );

      for (let i = 0; i < items.length; i++) {
        items[i]["products"] = [];

        // GOING TO SINGLE PRODUCT DETAIL PAGE
        for (let j = 0; j < items[i].links?.length; j++) {
          try {
            await page.goto(items[i]["links"][j], {
              waitUntil: "load",
              timeout: 900000,
            });
          } catch (e) {
            fs.appendFileSync(
              "lulu-error.log",
              "from Product click -- " + e + "\n"
            );
          }

          let productData = await page.evaluate(async () => {
            // PRODUCT NAME
            let Pname = await document.querySelector(
              ".product-description > h1"
            )?.innerText;

            // PRODUCT IMAGES
            let imageDoms = await Array.from(
              document.querySelectorAll(
                "#productShowcaseCarousel > div.owl-stage-outer > div > div"
              )
            );

            let images = [];
            imageDoms.forEach((data) => {
              images.push({
                image_url: data.querySelector("img")?.src,
              });
            });

            // PRODUCT PRICE
            let priceTag = await document.querySelector(
              ".price-tag.detail > .off"
            ); //OLD-PRICE
            let priceAndCurrency = getCurrencyAndPrice(priceTag);
            let oldPrice = priceAndCurrency?.price,
              currency = priceAndCurrency?.currency;

            priceTag = await document.querySelector(
              ".price-tag.detail > .current > span > span"
            ); //CURRENT-PRICE
            priceAndCurrency = getCurrencyAndPrice(priceTag);
            let currentPrice = priceAndCurrency?.price;

            // PRODUCT SUMMARIES
            let summaries = await Array.from(
              document.querySelectorAll(
                "body > main > main > section:nth-child(27) > section > div.container > div.section-container > div > div:nth-child(2) > div > div.description-block.mb-3.mt-md-0 > ul > li"
              )
            )?.map((value) => {
              if (value?.innerText) {
                return {
                  description: value?.innerText,
                };
              } else return {};
            });

            summaries = summaries.filter(
              (item) => Object.keys(item).length !== 0
            );

            // ---------------------- ESSENTIAL FUNCTIONS------------------
            function getCurrencyAndPrice(priceTag) {
              let price = "",
                currency = "";
              for (let i = 0; i < priceTag?.childNodes?.length; i++) {
                if (priceTag.childNodes[i]?.nodeName !== "SMALL") {
                  price += priceTag?.childNodes[i]?.textContent;
                } else currency += priceTag?.childNodes[i]?.textContent;
              }

              return {
                currency: currency,
                price: price,
              };
            }

            return {
              name: Pname,
              images: images,
              currency: currency,
              old_price: oldPrice,
              current_price: currentPrice,
              summaries: summaries,
            };
          });

          items[i]["products"].push(productData);
          // await page.waitForNavigation();

          // GOING BACK TO MAIN PAGE

          try {
            await page.goBack({
              waitUntil: "load",
              timeout: 900000,
            });
          } catch (e) {
            fs.appendFileSync("lulu-error.log", "from Go Back  -- " + e + "\n");
          }

          // console.log("product " + j + " done");
        }
      }

      await browser.close();

      items = {
        url: "https://luluhypermarket.com",
        name: "luluhypermarket",
        categories: items,
      };

      let baseUrl = "http://127.0.0.1:8001";
      // let baseUrl = "http://34.125.248.160";
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

      items = JSON.stringify(items);
      fs.writeFileSync("lulu.json", items);

      return resolve();
    } catch (e) {
      console.log("errror --------- ", e);
      fs.appendFileSync("lulu-error.log", e + "\n");
      return reject(e);
    }
  });
}
lulu();

// PM2 COMMANDS
// pm2 start index.js --cron "*/3 * * * *"  ----- TO MAKE 3 min cron
// PM2 PS - TO VIEW CRONS
// PM2 DELETE APPID
// pm2 start lulu.js --cron "0 0 * * *" //to run every 24 hour
// pm2 resurrect
// pm2 start ./lulu.js --no-autorestart --cron "0 0 * * *" --name "Lulu cron job-24h"
//pm2 start ./amazon.js --no-autorestart --cron "0 0 * * *" --name "Amazon cron job-24h"
// pm2 start ./main.js --no-autorestart --cron "0 0 * * *" --name "Main cron job-24h"

// pm2 start ./choitram.js --no-autorestart --cron "0 0 * * *" --name "Choitram job-24h"
// pm2 start ./noon.js --no-autorestart --cron "0 0 * * *" --name "Noon cron job-24h"
// pm2 start ./carrefouruae.js --no-autorestart --cron "0 0 * * *" --name "carrefouruae cron job-24h"

// (async () => {
//   const browser = await puppeteer.launch({
//     args: ['--proxy-server=PROXY_SERVER_ADDRESS']
//   });
//   const page = await browser.newPage();
//   await page.goto('https://example.com');
// })();
