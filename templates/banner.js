import color from "chalk";
import cfonts from "cfonts";

export default `
${cfonts.render('Bunosh', { font: 'pallet', gradient: ['blue','yellow'], colors: ['system'], space: false}).string}

  🍲 ${color.bold(color.dim.white('Bunosh'))} - your ${color.bold('exceptional')} task runner powered by Bun  
`.trim();
