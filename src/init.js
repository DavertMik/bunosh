import { BUNOSHFILE } from "./program";
import color from "picocolors";
import fs from "fs";
import templateFile from "../templates/init";

export default function init() {
  if (!fs.existsSync(BUNOSHFILE)) {
    fs.writeFileSync(BUNOSHFILE, templateFile());
    console.log(color.bold(`🎉 Bunosh ${BUNOSHFILE} file created`));
    console.log('   Edit it with "bunosh edit" command');
    console.log('   Or open it in your favorite editor');
    return;
  }

  console.error(`Bunosh file already exists: ${BUNOSHFILE}`);
}
