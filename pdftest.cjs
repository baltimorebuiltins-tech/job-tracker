const pdfMake = require('pdfmake/build/pdfmake.js');
const vfs = require('pdfmake/build/vfs_fonts.js');
pdfMake.addVirtualFileSystem(vfs);
pdfMake.fonts = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf'
  }
};
const docDef = {
  content: [{text: 'Hello Estimate', bold: true, fontSize: 20}],
};
const pdfDoc = pdfMake.createPdf(docDef);
pdfDoc.getBuffer((buffer) => {
  require('fs').writeFileSync('/tmp/test.pdf', buffer);
  console.log('wrote', buffer.length, 'bytes');
});
