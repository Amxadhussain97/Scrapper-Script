const puppeteer = require("puppeteer");
const fs = require("fs");
const axios = require("axios");

function amazon() {
  return new Promise(async (resolve, reject) => {
    try {
      // GETTING IN
      const browser = await puppeteer.launch({
        headless: true,
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

      let products = [],categoryPageUrl,
        rootProducts,
        isNextBtnVisible,
        title,
        nextBtn,
        isEmptyProduct,
        siteData = [];


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

      // GOING TO SINGLE CATEGORY DETAIL PAGE
      for (let i = 0; i < categories.length; i++) {
        siteData = {
          url: "https://www.amazon.ae",
          category: {
            name: categories[i]["name"],
            image_url: categories[i]["image_url"],
            products: [],
          },
        };
        products = [];
        console.log(" category in:  ", categories[i]["name"]);

       
        try {
          // GOING CATEGORY LINK
          await page.goto(categories[i].link, {
            waitUntil: ["load", "networkidle2"],
            timeout: 900000,
          });

          // HERE WAITING FOR SELECTOR TO LOAD
          await page.waitForSelector(
            "#grid-main-container > div.a-row.Grid-module__gridSection_1SEJTeTsU88s6aVeuuekAp > div > div",
            {
              visible: true,
              timeout: 900000,
            }
          );
        } catch (e) {
          fs.appendFileSync("amazon-error.log", "line 79 " + e + "\n");

          continue;
        }

       

        
        

        categoryPageUrl = await page.url();

        // CHECK WHETHER THE CATEGORY HAS NO PRODUCT
        isEmptyProduct = await page.$('div[role="note"]');
        if (isEmptyProduct) {
          continue;
        }

        // DEFINING NEXT BUTTON VISIBILITY
        isNextBtnVisible = true;
        let cnt = 1;
        while (isNextBtnVisible) {

          // WE NEED TO PERSIST PAGE LINK HERE  SO THAT WE CAN TURN BACK AFTER FETCHING DATA
          categoryPageUrl = await page.url();

          // THIS IS THE PRODUCT ROOT DIV NODE WHICH WILL CONTAIN ALL PRODUCT FROM CATEGORY PAGE
          rootProducts = await page.evaluate(async (el) => {
            // PARENT DIV
            let productElements = await Array.from(
              document.querySelectorAll(
                "#grid-main-container > div.a-row.Grid-module__gridSection_1SEJTeTsU88s6aVeuuekAp > div > div"
              )
            );

            let data = productElements.map((el) => {
              // WE WILL SCRAPE INDIVIDUAL PRODUCT CART DETAILS FROM HERE
              let pName = el.querySelector(
                "div.DealGridItem-module__dealItemContent_1vFddcq1F8pUxM8dd9FW32 > div > div > a:nth-child(3) > div"
              );

              let offer = el.querySelector(
                "div > div > div > a.a-size-mini.a-link-normal.DealLink-module__dealLink_3v4tPYOP4qJj9bdiy0xAT.a-color-base.a-text-normal > div:nth-child(1) > div"
              );

              let link = el.querySelector(
                "div.DealGridItem-module__dealItemContent_1vFddcq1F8pUxM8dd9FW32 > div > div > a:nth-child(3)"
              );

              let price = el.querySelector(
                "div > div > div > span > span > span:nth-child(2) > span.a-price-whole"
              );

              let image = el.querySelector("div > div > a > div > div > img");

              return {
                name: pName ? pName.textContent : "",
                image: image
                  ? {
                      image_url: image.src,
                    }
                  : "",
                offer: offer ? offer.textContent : "",
                link: link ? link.href : "",
                current_price: price ? price.textContent : "",
              };
            });

            return data;
          });

          console.log("root products are: ");
          rootProducts.forEach((item, index) => {
            console.log(index + 1, ". ", item?.name);
          });
          console.log("-----------------------------------");

          // GOING TO INDIVIDUAL PRODUCT AND GET EACH PRODUCT DETAILS
          for (let j = 0; j < rootProducts.length; j++) {
           
            console.log(
              "root product: ",
              j + 1,
              " : ",
              rootProducts[j]["name"]
            );
            rootProducts[j].subProducts = [];

            let hasMoved = false;

            // CLICKING EACH PRODUCT
            try {
              await page.goto(rootProducts[j].link, {
                waitUntil: ["load", "networkidle2"],
                timeout: 900000,
              });

              hasMoved = true;
            } catch (e) {
              fs.appendFileSync("amazon-error.log", "line 185 " + e + "\n");
              continue;
            }

            title = await page.$("#productTitle");

            // HERE WE ARE DIFFERENTIATING PAGE BY REALIZING TITLE ID SELECTOR
            if (title) {
              // THIS PAGE WILL HAVE DIRECT SINGLE PRODUCT DETAILS
              try {
                console.log(
                  "category: ",
                  categories[i]["name"],
                  " page: ",
                  cnt,
                  "single: "
                );
                let item = await getSingleProductDetails();
                console.log("item-name: ", item?.name);
                if (item) {
                  rootProducts[j].subProducts.push(item);
                }
              } catch (e) {
                fs.appendFileSync("amazon-error.log", "line 202 " + e + "\n");
                continue;
              }
            } 
            else {
              console.log(
                "category: ",
                categories[i]["name"],
                " page: ",
                cnt,
                " multiple: "
              );
              // THIS PAGE WILL HAVE MULTIPLE PRODUCT DETAILS(SUBPRODUCTS)
              try {
                let items = await getSubProductDetails(rootProducts[j].link);

                console.log("-- subproducts Are: ");
                items.forEach((item, idx) => {
                  console.log("--", idx + 1, " item-name:", item["name"]);
                });
                console.log("--");

                if (items?.length) {
                  rootProducts[j].subProducts = items;
                }
              } catch (e) {
                console.log("error ", e);
                fs.appendFileSync("amazon-error.log", e + "\n");
                continue;
              }
            }
          }

          products = [...products, ...rootProducts];

          // console.log(
          //   "-------------- going to main category -- ",
          //   categoryPageUrl
          // );

          try {
            // await page.close();
            // page = await browser.newPage();

            await page.goto(categoryPageUrl, {
              waitUntil: ["load", "networkidle2"],
              timeout: 900000,
            });

          } catch (e) {
            fs.appendFileSync("amazon-error.log", "line 243 " + e + "\n");
            reject();
            break;
          }

          // -----------HANDLING NEXT BUTTON-------------

          try {
            isNextBtnVisible = (await page.$("li.a-disabled.a-last")) === null;
            if (!isNextBtnVisible) {
              break;
            }
            nextBtn = await page.$("li.a-last");
            if (nextBtn) {
              try {
                // console.log("nextBtn::: ", nextBtn);
                await nextBtn.click();
                await page.waitForNavigation({
                  waitUntil: ["load", "networkidle2"],
                  timeout: 900000,
                });

                console.log("----------- next btn clicked --------");
              } catch (e) {
                fs.appendFileSync("amazon-error.log", "line 274 " + e + "\n");
                break;
              }
            } else break;
          } catch (e) {
            fs.appendFileSync("amazon-error.log", "line 256 " + e + "\n");
            await page.goto(categoryPageUrl, {
              waitUntil: "networkidle2",
              timeout: 900000,
            });
            break;
          }
          // -----------HANDLING NEXT BUTTON-------------
          cnt++;
          break;
        }

        console.log("cat " + i + " done");

        // categories[i]["products"] = products;

        siteData.category.products = [...products];

        fs.writeFileSync("amazon.json", JSON.stringify(siteData));

        await postDataByCategory(siteData);
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


        for (let i = 0; i < subProducts.length; i++) {
        
          try {
            await page.goto(subProducts[i].link, {
              waitUntil: ["load", "networkidle2"],
              timeout: 900000,
            });

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
                console.log("::::::::::::-----------------successs-----------------:::::::::::: ");
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

      // SCRAPING ENDED HERE

      // let items = {
      //   url: "https://www.amazon.ae",
      //   categories: [...categories],
      // };

      // console.log("successs---------------------items: ", items);
      // fs.writeFileSync("amazon.json", JSON.stringify(items));

      // let baseUrl = "http://34.125.248.160";
      // axios
      //   .post(`${baseUrl}/api/site-data`, items, [
      //     {
      //       headers: {
      //         "Content-Type": "application/json",
      //         Accept: "application/json",
      //       },
      //     },
      //   ])
      //   .then((response) => {
      //     console.log("amazon response: ", response);
      //   })
      //   .catch((e) => {
      //     fs.appendFileSync("amazon-error.log", "line 532 ", e + "\n");
      //   });

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
