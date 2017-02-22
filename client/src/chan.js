"use strict";

let BC_CHAN_ADDR = null;
let BC_CHAN_TXS = [];
let BC_CHAN_DECODING = null;

let bc_chan_step = (function() {
    let initialized = false;

    return function() {
        if (!initialized) {
            bc_chan_initialize();
            initialized = true;
        }

        if (BC_CHAN_ADDR !== BC_LAST_ADDR) {
            BC_CHAN_ADDR = BC_LAST_ADDR;
            let chan = document.getElementById("bc-chan");
            while (chan.hasChildNodes()) chan.removeChild(chan.lastChild);

            BC_CHAN_TXS = [];
            if (BC_TXS !== null) {
                for (let i=0, sz = BC_TXS.length; i<sz; ++i) {
                    let tx_hash = BC_TXS[i].hash;
                    BC_CHAN_TXS.push(tx_hash);
                    let msg = document.createElement("div");
                    msg.id = "bc-msg-"+tx_hash;
                    msg.classList.add("bc-msg");
                    msg.classList.add("bc-borderbox");
                    msg.appendChild(document.createTextNode(tx_hash));
                    chan.appendChild(msg);
                }
            }

            return;
        }

        if (BC_CHAN_DECODING !== null) {
            return;
        }

        if (BC_CHAN_TXS.length > 0) {
            let tx = BC_CHAN_TXS.shift();
            BC_CHAN_TXS.push(tx);
            let msg = document.getElementById("bc-msg-"+tx);
            if (msg !== null) {
                if (!msg.classList.contains("bc-msg-decoding")
                &&  !msg.classList.contains("bc-msg-decoded")) {
                    msg.classList.remove("bc-msg-failure");
                    msg.classList.add("bc-msg-decoding");
                    bc_chan_decode(tx);
                }
            }
        }
    };
})();

function bc_chan_initialize() {
    let chan = document.getElementById("bc-chan");
}

function bc_chan_decode(tx) {
    BC_CHAN_DECODING = tx;

    xmlhttpGet("https://blockchain.info/tx-index/"+tx+"?format=json&cors=true", '',
        function(json) {
            BC_CHAN_DECODING = null;

            let msgdiv = document.getElementById("bc-msg-"+tx);
            if (msgdiv === null) return;

            msgdiv.classList.remove("bc-msg-decoding");
            if (json === false || json === null) {
                msgdiv.classList.add("bc-msg-failure");
                return;
            }

            msgdiv.classList.add("bc-msg-decoded");
            let response = JSON.parse(json);

            if (typeof response === 'object') {
                let r = response;
                let msg  = "";
                let out_bytes= "";
                let op_return= "";
                let timestamp=  0;
                let op_return_msg = "";
                let filehash = null;

                let extract = bc_chan_extract_blockchaininfo(r);
                if (extract !== null) {
                    out_bytes = extract[0];
                    op_return = extract[1];
                    timestamp = extract[2];

                    let fsz = is_blockchain_file(out_bytes);
                    let blockchain_file = null;
                    if (fsz > 0) {
                        blockchain_file = out_bytes.substr(0, fsz);
                        let comment_start = fsz;
                        let comment_mod   = fsz % 20;
                        if (comment_mod !== 0) {
                            comment_start+= (20-comment_mod);
                        }
                        filehash = out_bytes.slice(comment_start, comment_start + 20);
                        filehash = Bitcoin.createAddressFromText(filehash);
                        out_bytes = out_bytes.slice(comment_start + 20); // 20 to compensate file hash.
                    }

                    let msg_utf8  = decode_utf8(out_bytes);
                    let msg_ascii = decode_ascii(out_bytes);

                    let len_utf8 = msg_utf8.length;
                    let len_ascii= msg_ascii.length;
                         if (len_utf8 <=        1) msg = msg_ascii;
                    else if (len_utf8 < len_ascii) msg = msg_ascii;
                    else                           msg = msg_utf8;

                    op_return_msg = decode_utf8(op_return);
                    if (op_return_msg.length <= 1) op_return_msg = decode_ascii(op_return);
                    if (op_return_msg.length >  1) {
                        if (msg.length > 1) msg = msg + "\n";
                        msg = msg + "-----BEGIN OP_RETURN MESSAGE BLOCK-----\n" 
                                  + op_return_msg + "\n----- END OP_RETURN MESSAGE BLOCK -----";
                    }
                    let txt = msg;

                    while (msgdiv.hasChildNodes()) msgdiv.removeChild(msgdiv.lastChild);
                    msgdiv.appendChild(document.createTextNode(txt));
                }
            }
        }
    );
}

function bc_chan_extract_blockchaininfo(r) {
    var out_bytes= "";
    var op_return= "";
    var outs = r.out.length;

    for (var j = 0; j < outs; j++) {
        if ("addr" in r.out[j]) {
            out_bytes = out_bytes + Bitcoin.getAddressPayload(r.out[j].addr);
        }
        else if ("script" in r.out[j] && r.out[j].script.length > 4) {
            var OP = r.out[j].script.substr(0, 2);
            if (OP.toUpperCase() === "6A") {
                // OP_RETURN detected
                var hex_body = r.out[j].script.substr(4);
                op_return = op_return + hex2ascii(hex_body);
            }
        }
    }
    return [out_bytes, op_return, r.time];
}

