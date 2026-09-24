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
(async () => {
  try {
    const pdfDoc = pdfMake.createPdf(docDef);
    const base64 = await pdfDoc.getBase64();
    require('fs').writeFileSync('/tmp/test2.pdf', Buffer.from(base64, 'base64'));
    console.log('wrote base64 length', base64.length);
  } catch (e) {
    console.error('ERR', e);
  }
})();
