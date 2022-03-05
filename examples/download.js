const path = require('path');
const downloadCmd = require('./../lib/cmd-download').default;

let context = {
  id: 'Pornhub',
  proxy: 'http://127.0.0.1:1087',
  url: 'https://cn.pornhub.com',
  dlPath: path.resolve('./downloads'),
  //
  pornhubID: 'ph5f59e1a1b5fc6',
  pornhubWatch: false,
};

(async () => {
  await downloadCmd(context);
})();
