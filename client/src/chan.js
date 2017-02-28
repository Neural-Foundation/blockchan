"use strict";

var BC_CHAN_ADDR = null;
var BC_CHAN_TXS = [];
var BC_CHAN_DECODING = null;

var bc_chan_step = (function() {
    var initialized = false;

    return function() {
        if (!initialized) {
            bc_chan_initialize();
            initialized = true;
        }

        if (BC_CHAN_ADDR !== BC_LAST_ADDR) {
            BC_CHAN_ADDR = BC_LAST_ADDR;
            var chan_read = document.getElementById("bc-chan-read");
            while (chan_read.hasChildNodes()) chan_read.removeChild(chan_read.lastChild);

            BC_CHAN_TXS = [];
            if (BC_TXS !== null) {
                for (var i=0, sz = BC_TXS.length; i<sz; ++i) {
                    var tx_hash = BC_TXS[i].hash;
                    BC_CHAN_TXS.push(tx_hash);
                    var msg = document.createElement("div");
                    msg.id = "bc-msg-"+tx_hash;
                    msg.classList.add("bc-msg");
                    msg.classList.add("bc-borderbox");
                    msg.appendChild(document.createTextNode(tx_hash));
                    chan_read.appendChild(msg);
                }
            }

            return;
        }

        if (BC_CHAN_DECODING !== null) {
            return;
        }

        if (BC_CHAN_TXS.length > 0) {
            var tx = BC_CHAN_TXS.shift();
            BC_CHAN_TXS.push(tx);
            var msg = document.getElementById("bc-msg-"+tx);
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
    var chan_write = document.getElementById("bc-chan-write");
    var text_area = document.createElement("textarea");
    text_area.id = "bc-chan-write-textarea";
    text_area.classList.add("bc-borderbox");

    /*
    var wrapper_table = document.createElement("div");
    wrapper_table.style.width="100%";
    wrapper_table.style.height="100%";
    wrapper_table.style.display="table";
    var wrapper_cell = document.createElement("div");
    wrapper_cell.style.display="table-cell";
    wrapper_cell.style.verticalAlign="middle";
    var wrapper = document.createElement("div");
    wrapper.style.marginLeft="auto";
    wrapper.style.marginRight="auto";

    wrapper.appendChild(text_area);
    wrapper_cell.appendChild(wrapper);
    wrapper_table.appendChild(wrapper_cell);
    chan_write.appendChild(wrapper_table);
    */

    var btn_1 = document.createElement("BUTTON");
    var btn_2 = document.createElement("BUTTON");
    btn_1.appendChild(document.createTextNode("BACK"));
    btn_2.appendChild(document.createTextNode("POST"));
    btn_1.style.width="100%";
    btn_2.style.width="100%";
    btn_1.style.maxWidth="10ch";
    btn_2.style.maxWidth="10ch";

    btn_1.addEventListener("click", bc_chan_button_click_back);
    btn_2.addEventListener("click", bc_chan_button_click_post);

    var t = document.createElement("table");
    var tr = document.createElement("tr");
    var td1 = document.createElement("td");
    var td2 = document.createElement("td");
    var td3 = document.createElement("td");
    tr.style.height="100%";
    t.style.width="100%";
    t.style.height="100%";

    td1.appendChild(btn_1);
    td2.appendChild(text_area);
    td3.appendChild(btn_2);
    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    t.appendChild(tr);
    chan_write.appendChild(t);
}

function bc_chan_decode(tx) {
    BC_CHAN_DECODING = tx;

    xmlhttpGet("https://blockchain.info/tx-index/"+tx+"?format=json&cors=true", '',
        function(json) {
            BC_CHAN_DECODING = null;

            var msgdiv = document.getElementById("bc-msg-"+tx);
            if (msgdiv === null) return;

            msgdiv.classList.remove("bc-msg-decoding");
            if (json === false || json === null) {
                msgdiv.classList.add("bc-msg-failure");
                return;
            }

            msgdiv.classList.add("bc-msg-decoded");
            var response = JSON.parse(json);

            if (typeof response === 'object') {
                var r = response;
                var msg  = "";
                var out_bytes= "";
                var op_return= "";
                var timestamp=  0;
                var op_return_msg = "";
                var filehash = null;

                var extract = bc_chan_extract_blockchaininfo(r);
                if (extract !== null) {
                    out_bytes = extract[0];
                    op_return = extract[1];
                    timestamp = extract[2];

                    var fsz = is_blockchain_file(out_bytes);
                    var blockchain_file = null;
                    if (fsz > 0) {
                        blockchain_file = out_bytes.substr(0, fsz);
                        var comment_start = fsz;
                        var comment_mod   = fsz % 20;
                        if (comment_mod !== 0) {
                            comment_start+= (20-comment_mod);
                        }
                        filehash = out_bytes.slice(comment_start, comment_start + 20);
                        filehash = Bitcoin.createAddressFromText(filehash);
                        out_bytes = out_bytes.slice(comment_start + 20); // 20 to compensate file hash.
                    }

                    var msg_utf8  = decode_utf8(out_bytes);
                    var msg_ascii = decode_ascii(out_bytes);

                    var len_utf8 = msg_utf8.length;
                    var len_ascii= msg_ascii.length;
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
                    var txt = msg;

                    while (msgdiv.hasChildNodes()) msgdiv.removeChild(msgdiv.lastChild);

                    if (timestamp != 0) {
                        msgdiv.appendChild(document.createTextNode(timeConverter(timestamp)));
                        msgdiv.appendChild(document.createElement("br"));
                    }

                    msgdiv.appendChild(document.createTextNode(txt));

                    var t_txid = document.createTextNode(tx);
                    var a_txid = document.createElement("a");
                    a_txid.appendChild(t_txid);
                    a_txid.title = "View in BlockChain.info.";
                    a_txid.href  = "https://blockchain.info/tx/"+tx;
                    a_txid.target= "_blank";
                    a_txid.classList.add("bc-txs-link");

                    msgdiv.appendChild(document.createElement("br"));
                    msgdiv.appendChild(a_txid);
                    msgdiv.appendChild(document.createElement("hr"));
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

function bc_chan_button_click_back() {
    if (history.pushState) {
        history.pushState(null, null, '#');
    }
    else {
        location.hash = '#';
    }
}

function bc_chan_button_click_post() {
    var text_area = document.getElementById("bc-chan-write-textarea");
    var txt = encodeURIComponent(text_area.value);
    window.open("http://cryptograffiti.info#"+BC_CHAN_ADDR+"#write:"+txt, "_blank");
}

