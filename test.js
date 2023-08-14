const puppeteer = require("puppeteer");
const fs = require("fs");
const axios = require("axios");

function amazon() {
  return new Promise(async (resolve, reject) => {
    try {
      // GETTING IN
      const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: false,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
          "--disable-gpu",
          "--ignore-certificate-errors",
        ],
      });

      let page = await browser.newPage();
      const client = await page.target().createCDPSession();
      await page.setCacheEnabled(true);
      const { width, height } = {
        width: 2300,
        height: 3080,
      };
      await page.setViewport({ width, height });
      await page.goto("https://www.amazon.ae/deals?ref_=nav_cs_gb", {
        waitUntil: ["load", "networkidle2"],
        timeout: 900000,
      });
      // await page.waitForNavigation()
      // SITE LOADED

      // GET ALL CATEGORY DETAILS

      let categories = await page.$$eval(
        "#anonCarousel1 > ol > li > a",
        (items) => {
          return items.map((item) => {
            return {
              // select last span
              name: item.querySelector("span:last-of-type").innerText,
              link: item.href,
              dataTestId: item.getAttribute("data-testid"),
              image_url: item.querySelector(
                "span.GridPresets-module__gridPresetImageSection_2p68sRHExZZwCJorBe2_N3 > img"
              ).src,
              products: [],
            };
          });
        }
      );

      categories.shift();

      let mainPageUrl = await page.url();

      let products = [],
        rootProducts,
        isNextBtnVisible,
        title,
        nextBtn,
        isEmptyProduct,
        siteData = [];

      // GOING TO SINGLE CATEGORY DETAIL PAGE
      for (let i = 0; i < categories.length; i++) {
        try {
          await page.click(`[data-testid="${categories[i]["dataTestId"]}"]`, {
            waitUntil: ["load", "networkidle2"],
            timeout: 900000,
          });

          await page.waitForNavigation({
            waitUntil: "networkidle2",
            timeout: 900000,
          });
        } catch (e) {
          fs.appendFileSync("amazon-error.log", "line 79 " + e + "\n");

          continue;
        }

        mainPageUrl = await page.url();
        categories[i].link = mainPageUrl;
      }

      for (let i = 0; i < categories.length; i++) {

        console.log("Going To Cat:: ",i+1);
        try {
          await page.goto(categories[i].link, {
            waitUntil: ["load", "networkidle2"],
            timeout: 900000,
          });
        } catch (e) {
          fs.appendFileSync("amazon-error.log", "line 103 " + e + "\n");

          continue;
        }

        console.log("Finish Cat:: ",i+1);
      }

      // THIS FUNCTION IS FOR SCRAPING SINGLE PRODUCT DETAILS
      async function getSingleProductDetails() {
        let subProduct = await page.evaluate(
          async () => {
            let sTitle = await document.querySelector("#productTitle");
            let sOffer = await document.querySelector(
              "#corePriceDisplay_desktop_feature_div > div.a-section.a-spacing-none.aok-align-center > span.a-size-large.a-color-price.savingPriceOverride.aok-align-center.reinventPriceSavingsPercentageMargin.savingsPercentage"
            );
            let sCuPrice = await document.querySelector(
              "#corePriceDisplay_desktop_feature_div > div.a-section.a-spacing-none.aok-align-center > span.a-price.aok-align-center.reinventPricePriceToPayMargin.priceToPay > span:nth-child(2) > span.a-price-whole"
            );
            let sCuPriceFra = await document.querySelector(
              "#corePriceDisplay_desktop_feature_div > div.a-section.a-spacing-none.aok-align-center > span.a-price.aok-align-center.reinventPricePriceToPayMargin.priceToPay > span:nth-child(2) > span.a-price-fraction"
            );
            let currency = await document.querySelector(
              "#corePriceDisplay_desktop_feature_div > div.a-section.a-spacing-none.aok-align-center > span.a-price.aok-align-center.reinventPricePriceToPayMargin.priceToPay > span:nth-child(2) > span.a-price-symbol"
            );
            let oPrice = await document.querySelector(
              "#corePriceDisplay_desktop_feature_div > div.a-section.a-spacing-small.aok-align-center > span > span.a-size-small.a-color-secondary.aok-align-center.basisPrice > span > span.a-offscreen"
            );

            let pColor = await document.querySelector(
              "#variation_color_name > div > span"
            );

            let details = await Array.from(
              document.querySelectorAll(
                "#productOverview_feature_div > div > table > tbody > tr"
              )
            );
            let detailsData = details.map(async (el) => {
              // await el.waitForSelector("td.a-span3 > span", {visible: true, timeout: 900000})
              let title = await el.querySelector("td:nth-child(1)");
              let description = await el.querySelector("td:nth-child(2)");

              return {
                title: title?.innerText,
                description: description?.innerText,
              };
            });

            let image = await document.querySelector("#landingImage");

            let summaries = await Array.from(
              document.querySelectorAll("#feature-bullets > ul > li")
            ).map((item) => {
              return {
                description: item?.textContent,
              };
            });

            let sRating = await document.querySelector(
              "#acrPopover > span.a-declarative > a > i.a-icon.a-icon-star > span"
            );

            let rating = {
              rating: "",
              rated_out_of: "",
            };
            if (sRating) {
              sRating = sRating.textContent;
              let ratingValeus = sRating.split(" ");
              rating.rating = parseFloat(ratingValeus[0]);
              rating.rated_out_of = parseFloat(ratingValeus[3]);
            }

            return {
              name: sTitle ? sTitle.textContent : "",
              rating: rating,
              offer: sOffer ? sOffer.textContent : "",
              current_price: sCuPrice
                ? sCuPrice.textContent + sCuPriceFra.textContent
                : "",
              old_price: oPrice
                ? parseFloat(
                    oPrice.textContent.replace(currency.textContent, "")
                  )
                : "",
              currency: currency ? currency.textContent : "",
              details: detailsData,
              color: pColor ? pColor.textContent : "",
              summaries: summaries,
              images: image
                ? [
                    {
                      image_url: image.src,
                    },
                  ]
                : "",
            };
          },
          {
            visible: true,
            timeout: 900000,
          }
        );

        return subProduct;
      }

      // THIS FUNCTION WILL SRAPE PRODUCT DATA WHICH WILL HAVE MULTIPLE SUB PRODUCT
      async function getSubProductDetails(rootProductLink) {
        let subProducts = await page.evaluate(async () => {
          let items = await Array.from(
            document.querySelectorAll("#octopus-dlp-asin-stream > ul > li")
          );

          let data = [];
          items.forEach(async (el) => {
            let name = await el.querySelector(
              "span > div > div.a-section.octopus-dlp-asin-info-section > div.a-section.octopus-dlp-asin-title > a"
            );
            let link = name ? name.href : "";
            name = name ? name.innerText : "";

            let image = await el.querySelector(
              "span > div > div.a-section.a-spacing-base.a-text-center.octopus-dlp-image-section > a > img"
            );
            image = image ? image.src : "";

            // OFFER STARTS
            let offerLeft = await el.querySelector(
              "span > div > div.a-section.octopus-dlp-asin-info-section > div.a-row.a-spacing-mini.a-grid-vertical-align.a-grid-center > div > div.a-size-mini.oct-deal-badge-element.oct-deal-badge-label > span:nth-child(1)"
            );
            let offerRight = await el.querySelector(
              "span > div > div.a-section.octopus-dlp-asin-info-section > div.a-row.a-spacing-mini.a-grid-vertical-align.a-grid-center > div > div.a-size-mini.oct-deal-badge-element.oct-deal-badge-label > span:nth-child(2)"
            );

            let offer = "";
            if (offerLeft && offerRight) {
              offer = offerLeft.textContent + offerRight.textContent;
            }
            // OFFER ENDS

            let currency = await el.querySelector(
              "span > div > div.a-section.octopus-dlp-asin-info-section > div.a-row.octopus-dlp-price > span.a-price.octopus-widget-price > span:nth-child(2) > span.a-price-symbol"
            );
            currency = currency ? currency.textContent : "";

            let cuPrice = await el.querySelector(
              "span > div > div.a-section.octopus-dlp-asin-info-section > div.a-row.octopus-dlp-price > span.a-price.octopus-widget-price > span:nth-child(2) > span.a-price-whole"
            );
            cuPrice = cuPrice ? cuPrice.textContent : "";

            let cuPriceFraction = await el.querySelector(
              "span > div > div.a-section.octopus-dlp-asin-info-section > div.a-row.octopus-dlp-price > span.a-price.octopus-widget-price > span:nth-child(2) > span.a-price-fraction"
            );
            cuPriceFraction = cuPriceFraction
              ? cuPriceFraction.textContent
              : "";

            let oldPrice = await el.querySelector(
              "span > div > div.a-section.octopus-dlp-asin-info-section > div.a-row.octopus-dlp-price > span.octopus-widget-price-saving-info > span.a-size-mini.a-color-tertiary.octopus-widget-strike-through-price.a-text-strike"
            );
            oldPrice = oldPrice
              ? parseFloat(
                  oldPrice.textContent.replace(currency.textContent, "")
                )
              : "";

            // RATING STARTS
            let sRating = await el.querySelector(
              " span > div > div.a-section.octopus-dlp-asin-info-section > div:nth-child(2) > i > span"
            );
            let rating = {
              rating: "",
              rated_out_of: "",
            };
            if (sRating) {
              sRating = sRating.textContent;
              let ratingValeus = sRating.split(" ");
              rating.rating = parseFloat(ratingValeus[0]);
              rating.rated_out_of = parseFloat(ratingValeus[3]);
            }
            // RATING ENDS
            data.push({
              link: link,
              name: name,
              images: [
                {
                  image_url: image,
                },
              ],
              offer: offer,
              currency: currency,
              currentPrice: cuPrice + cuPriceFraction,
              oldPrice: oldPrice,
              rating: rating,
            });
          });

          return data;
        });

        let hasMoved = false;

        for (let i = 0; i < subProducts.length; i++) {
          await page.close();

          page = await browser.newPage();

          try {
            await page.goto(subProducts[i].link, {
              waitUntil: ["load", "networkidle2"],
              timeout: 900000,
            });

            hasMoved = true;
          } catch (e) {
            fs.appendFileSync("error.log", "line 487 " + e + "\n");
            continue;
          }

          let newProduct = [];
          try {
            let item = await getSingleProductDetails();
            newProduct.push(item);
          } catch (e) {
            fs.appendFileSync("amazon-error.log", "line 508 " + e + "\n");
            continue;
          }

          subProducts[i]["subProducts"] = [...newProduct];
        }

        return subProducts;
      }

      async function postDataByCategory(data) {
        // let baseUrl = "http://127.0.0.1:8000";
        let baseUrl = "http://34.125.248.160";

        try {
          await axios
            .post(`${baseUrl}/api/site-data-by-category`, data, [
              {
                headers: {
                  "Content-Type": "application/json",
                  Accept: "application/json",
                },
              },
            ])
            .then((response) => {
              // check status
              if (response.status === 200) {
                console.log(
                  "::::::::::::-----------------successs-----------------:::::::::::: "
                );
              }
            })
            .catch((e) => {
              fs.appendFileSync("amazon-error.log", "line 532 ", e + "\n");
            });
        } catch (e) {
          fs.appendFileSync("amazon-error.log", "line 538 ", e + "\n");
        }
      }

      await page.close();
      await browser.close();

      return resolve();
    } catch (e) {
      console.log("errror --------- ", e);
      fs.appendFileSync("amazon-error.log", "line 538 " + e + "\n");
      return reject(e);
    }
    // finally {
    //   await browser?.close();
    // }
  });
}

amazon();
