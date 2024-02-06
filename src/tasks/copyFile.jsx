const { copySync } = require('fs-extra');
import { task } from '../task.jsx';

export default function copyFile(src, dst) {

  task(`copy ${src} ⇒ ${dst}`, () => {
    copySync(src, dst);
  });

}




