var test = require('tape');
var SCRAM = require('../');



test('SCRAM', async function (t) {
    var mech = new SCRAM({
        genNonce: function () {
            return 'MsQUY9iw0T9fx2MUEz6LZPwGuhVvWAhc';
        }
    });

    var creds = {
        username: 'chris',
        password: 'secret'
    };

    var initial = await mech.response(creds);

    t.equal(initial, 'n,,n=chris,r=MsQUY9iw0T9fx2MUEz6LZPwGuhVvWAhc');

    await mech.challenge('r=MsQUY9iw0T9fx2MUEz6LZPwGuhVvWAhc7b276f42-009a-40e2-84ee-8d5c8b206b6a,s=OTFmZGE2ZGQtYjA0Yy00MTRiLTk1ZTktYTkyYWRlMmVkYTc5,i=4096');

    var res = await mech.response(creds);

    t.equal(res, 'c=biws,r=MsQUY9iw0T9fx2MUEz6LZPwGuhVvWAhc7b276f42-009a-40e2-84ee-8d5c8b206b6a,p=WKFCdDykcs73+CG653eG721vItw=');

    t.end();
});
