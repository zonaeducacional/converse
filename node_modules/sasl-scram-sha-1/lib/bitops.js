/* jslint bitwise: true */

exports.XOR = function (a, b) {
  var res = [];
  if (a.length > b.length) {
    for (var i = 0; i < b.length; i++) {
      res.push(a[i] ^ b[i]);
    }
  } else {
    for (var j = 0; j < a.length; j++) {
      res.push(a[j] ^ b[j]);
    }
  }
  return new Uint8Array(res);
};

exports.H = async function (text) {
    return new Uint8Array(
        await crypto.subtle.digest("SHA-1", text)
    );
};

exports.HMAC = async function (key, msg) {
    const hmac = await crypto.subtle.importKey(
        "raw",
        key,
        // https://developer.mozilla.org/en-US/docs/Web/API/HmacImportParams
        { name: "HMAC", hash: "SHA-1" },
        false, // extractable
        ["sign"],
    );
    return new Uint8Array(await crypto.subtle.sign(
        "HMAC",
        hmac,
        msg,
    ));
};

exports.Hi = async function (text, salt, iterations) {
    const key = new TextEncoder().encode(text);
    var concat = new Uint8Array(salt.length + 4);
    concat.set(salt);
    concat.set(new Uint8Array([0, 0, 0, 1]), salt.length);
    var ui1 = await exports.HMAC(key, concat);
    var ui = ui1;
    for (var i = 0; i < iterations - 1; i++) {
        ui1 = await exports.HMAC(key, ui1);
        ui = exports.XOR(ui, ui1);
    }

    return ui;
};

