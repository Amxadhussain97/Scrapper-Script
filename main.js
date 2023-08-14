const { exec } = require("child_process");

exec("node amazon.js", (error) => {
  if (error) {
    console.error(`exec error: ${error}`);
    return;
  }

  exec("node lulu.js", (error) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return;
    }
  });

  // exec("node lulu.js", (error, stdout, stderr) => {
  //   if (error) {
  //     console.error(`exec error: ${error}`);
  //     return;
  //   }
  //   console.log(`stdout: ${stdout}`);
  //   console.log(`stderr: ${stderr}`);
  // });

});
