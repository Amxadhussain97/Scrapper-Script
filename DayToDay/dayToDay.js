const puppeteer = require("puppeteer");
const fs = require("fs");
const axios = require("axios");

function run() {
  return new Promise(async (resolve, reject) => {
    try {
      const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: false,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();
      await page.goto("https://daytoday.ae/",{
        waitUntil: "networkidle2",
        timeout: 80000


      });

   

      let products = await page.evaluate(async () => {
        let items = await Array.from(
          document.querySelectorAll(
            "#root > div.wrapper > div:nth-child(6) > div > div > div:nth-child(2) > div > div.slick-list > div > div"
          )
        );
        let data = [];

         items.forEach(async (item) => {
          let name = await item.querySelector("div > div > div > div.product-text-dt > a > h4")
            .innerText;
          let link = await item?.querySelector("div > div > div > div.product-text-dt > a")?.href;
        
          // console.log("filter ",filteredData);

          data.push({
            name,
            link
          });
        });
        return data;
      });


      // make a loop on products and goto the link
      for(let i=0;i<products.length;i++){
        await page.goto(products[i].link,{
          waitUntil: "networkidle2",
          timeout: 80000
        });

        let priceData = await page.evaluate(async () => {
          let val = await document.querySelector("#root > div.wrapper > div.all-product-grid > div > div:nth-child(1) > div > div > div > div.col-lg-5.col-md-6.col-sm-6 > div > div:nth-child(8) > ul > li:nth-child(1) > div > span").innerText;
          return val;
        });

        let currentPrice = priceData.split(" ")[1];
        let currency =  priceData.split(" ")[0];

        let oldPrice = await page.evaluate(async () => {
          let val = await document.querySelector("#root > div.wrapper > div.all-product-grid > div > div:nth-child(1) > div > div > div > div.col-lg-5.col-md-6.col-sm-6 > div > div:nth-child(8) > ul > li:nth-child(2) > div > span").innerText;
          val = val.split(" ")[1];
          return val;
        });
        

        let offer = await page.evaluate(async () => {
          let val = await document.querySelector("#root > div.wrapper > div.all-product-grid > div > div:nth-child(1) > div > div > div > div.col-lg-5.col-md-6.col-sm-6 > div > div:nth-child(8) > ul > li:nth-child(3) > div > span").innerText;
          return val;
        });

        let image_url = await page.evaluate(async () => {
          let val = await document.querySelector("#root > div.wrapper > div.all-product-grid > div > div:nth-child(1) > div > div > div > div.col-lg-4.col-md-6.col-sm-6 > div > div > div.magnify-wrap > img").src;
          return val;
        });


        products[i].currentPrice = currentPrice;
        products[i].currency = currency;
        products[i].oldPrice = oldPrice;
        products[i].offer = offer;
        products[i].image_url = image_url;




        break;

      }

      console.log("data ",products)

    //   fs.writeFileSync("amazon.json", JSON.stringify(data));

      //

      await browser.close();
      return resolve();
    } catch (e) {
      console.log("errror --------- ", e);
      fs.appendFileSync("lulu-error.log", e + "\n");
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
