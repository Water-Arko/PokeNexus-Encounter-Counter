// ==UserScript==
// @name         PokeNexus Encounter Counter
// @description  This script shows an overlay for PokeNexus which keeps track of how many encounters you have done and how much money you have gained from them. "Shift + \" to reset the value.
// @version      1.0.2
// @author       WaterArko
// @license      MIT
// @supportURL   https://github.com/Water-Arko/PokeNexus-Encounter-Counter
// @downloadURL  https://github.com/Water-Arko/PokeNexus-Encounter-Counter/raw/main/PNEC.user.js
// @updateURL    https://github.com/Water-Arko/PokeNexus-Encounter-Counter/raw/main/PNEC.user.js
// @namespace    https://poke-nexus.com/
// @match        https://poke-nexus.com/forums/game/*
// @icon         https://poke-nexus.com/favicon.ico
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    // === SECTION: Define HTML constants ===
    const backgroundId = "overlay_bg";

    const counterDivId = "encounter_counter";
    const counterSpanId = "local_counter";
    const globalCounterSpanId = "global_counter";
    const moneyDivId = "money_counter";
    const moneySpanId = "moneeeeeey";
    const globalMoneySpanId = "all_of_the_money";

    const counterText = "Encounters: ";
    const globalCounterText = "total count: ";
    const moneyText = "Money: ";
    const globalMoneyText = "total money: ";

    const counterDivHtml = counterText + '<span id="' + counterSpanId + '">' + GM_getValue("ec", 0) + '</span>' +
                        ' (' + globalCounterText + '<span id="' + globalCounterSpanId + '">' + GM_getValue("ec_g", 0) + '</span>)';

    const moneyDivHtml = moneyText + '<span id="' + moneySpanId + '">$' + GM_getValue("mc", 0) + '</span>' +
                       ' (' + globalMoneyText + '<span id="' + globalMoneySpanId + '">$' + GM_getValue("mc_g", 0) + '</span>)';

    const textLeftOffset = 8;
    const counterTopOffset = 10;
    const moneyTopOffset = 32;
    const bgRightOffset = 10;

    // These constants are used for detecting an encounter / money change respectively.
    const encounterStr = '|battleType|WILD'; // This may trigger erroneously, as there may be other instances of this data being sent.
    const moneyStr = 'You gained $';

    // === SECTION: WebSocket hook ===
    // Source - https://stackoverflow.com/a/31182643 (Posted by Rob W, modified by community; Retrieved 2026-07-10; License - CC BY-SA 3.0)
    var OrigWebSocket = unsafeWindow.WebSocket;
    var callWebSocket = OrigWebSocket.apply.bind(OrigWebSocket);
    var wsAddListener = OrigWebSocket.prototype.addEventListener;
    wsAddListener = wsAddListener.call.bind(wsAddListener);

    unsafeWindow.WebSocket = function WebSocket(url, protocols) {
        var ws;
        if (!(this instanceof WebSocket)) {
            // Called without 'new' (browsers will throw an error).
            ws = callWebSocket(this, arguments);
        } else if (arguments.length === 1) {
            ws = new OrigWebSocket(url);
        } else if (arguments.length >= 2) {
            ws = new OrigWebSocket(url, protocols);
        } else { // No arguments (browsers will throw an error).
            ws = new OrigWebSocket();
        }

        // Initialise all the HTML elements for the overlay.
        initHead();
        createBackground();
        createOverlay(counterDivId, counterDivHtml, counterTopOffset, textLeftOffset);
        createOverlay(moneyDivId, moneyDivHtml, moneyTopOffset, textLeftOffset);
        updateOverlay();

        // Add a listener to any message that we receive from the WebSocket.
        wsAddListener(ws, 'message', function(event) {
            var index;
            // Upon receiving data, convert it to text, and…
            event.data.text().then(function(value) {
                // … if the data contains an encounter "request", increment the counter.
                if(value.includes(encounterStr)) {
                    incrementCounter();
                }
                // … otherwise, if the data contains a message about receiving money…
                else if((index = value.indexOf(moneyStr)) !== -1) { // … find its index, and append the found string's length to find the value we are looking for.
                    index += moneyStr.length; // This should always resolve to 47, assuming the data always follows the same structure.

                    // Here we convert the data into bytes, as most of the payload contents (including immediately after the value) is binary.
                    event.data.bytes().then(function(byteValue) {
                        var terminateIndex = byteValue.indexOf(0, index); // Locate the index of a "00" byte, starting from the string index, as the byte also appears before.
                        var numBytes = byteValue.subarray(index, terminateIndex); // We capture the bytes between the string and the terminating byte…
                        var numStr = new TextDecoder().decode(numBytes); // … convert them into a string…
                        var result = parseInt(numStr); // … and parse the string as an integer. TODO: There's no error handling, lol.

                        // Finally, append the captured data to our money total!
                        addMoney(result);
                    })
                }
            });
        });
        return ws;
    }.bind();

    unsafeWindow.WebSocket.prototype = OrigWebSocket.prototype;
    unsafeWindow.WebSocket.prototype.constructor = unsafeWindow.WebSocket;

    // Send data back through the hooked WebSocket without modifying them.
    var wsSend = OrigWebSocket.prototype.send;
    wsSend = wsSend.apply.bind(wsSend);

    OrigWebSocket.prototype.send = function(data) {
        return wsSend(this, arguments);
    };

    // === SECTION: Overlay initialisers ===
    function initHead() {
        // Add the 'Roboto' font to the styles.
        var link = document.createElement('link');
        link.setAttribute('rel', 'stylesheet');
        link.setAttribute('type', 'text/css');
        link.setAttribute('href', 'https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100..900;1,100..900&display=swap');
        document.head.appendChild(link);
    }

    function createBackground() {
        // Create the background container.
        var overlay = document.createElement('div');
        overlay.id = backgroundId;

        // Apply CSS styling.
        overlay.style.backgroundColor = 'rgba(42, 41, 40, 0.75)';
        overlay.style.height = '61px';
        overlay.style.position = 'fixed';
        overlay.style.pointerEvers = 'none';

        // Append child to the body. Obviously.
        document.body.appendChild(overlay);
    }

    function createOverlay(id, text, topOffset, leftOffset) {
        // Create the overlay container.
        var overlay = document.createElement('div');
        overlay.id = id;
        overlay.innerHTML = text;

        // Apply CSS styling.
        overlay.style.position = 'fixed';
        overlay.style.top = topOffset;
        overlay.style.left = leftOffset;
        overlay.style.zIndex = '999';
        overlay.style.color = '#FFF';
        overlay.style.fontFamily = 'Roboto, sans-serif';
        overlay.style.fontSize = '16px';
        overlay.style.pointerEvents = 'none';
        overlay.style.textShadow = '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000';

        // Append child to the body. Obviously.
        document.body.appendChild(overlay);
    }

    // === SECTION: Manipulating the counters ===
    function incrementCounter() {
        GM_setValue("ec", GM_getValue("ec", 0) + 1);
        GM_setValue("ec_g", GM_getValue("ec_g", 0) + 1);
        updateOverlay();
    }

    function addMoney(value) {
        GM_setValue("mc", GM_getValue("mc", 0) + value);
        GM_setValue("mc_g", GM_getValue("mc_g", 0) + value);
        updateOverlay();
    }

    function resetCount() {
        console.log("Counters reset to 0.");
        GM_setValue("ec", 0);
        GM_setValue("mc", 0);
        updateOverlay();
    }

    function updateOverlay() {
        document.getElementById(counterSpanId).innerHTML = GM_getValue("ec", 0);
        document.getElementById(globalCounterSpanId).innerHTML = GM_getValue("ec_g", 0);

        document.getElementById(moneySpanId).innerHTML = GM_getValue("mc", 0);
        document.getElementById(globalMoneySpanId).innerHTML = GM_getValue("mc_g", 0);

        // Resize the overlay background based on the largest width.
        let maxWidth = Math.max(document.getElementById(counterDivId).clientWidth, document.getElementById(moneyDivId).clientWidth);
        document.getElementById(backgroundId).style.width = maxWidth + textLeftOffset + bgRightOffset;
    }

    // Shortcut to reset the non-total counters.
    document.addEventListener("keydown", (event) => {
        // Ignore keystrokes if the user is currently typing in a text field or form input
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable) {
            return;
        }
        if (event.keyCode === 220 && event.shiftKey) { // Currently set to Shift + '\'.
            resetCount();
        }
    });
})();
