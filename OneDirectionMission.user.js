// ==UserScript==
// @name         One Direction Mission v1.1
// @namespace    GeoGuessr scripts
// @version      1.1
// @description  Only travel in one direction.
// @match        https://www.geoguessr.com/*
// @author       echandler
// @run-at       document-start
// @downloadURL  https://github.com/echandler/One-Direction-Mission/raw/main/OneDirectionMission.user.js
// @license      MIT
// @grant        GM_addStyle
// ==/UserScript==

GM_addStyle(" .hoooover:hover { outline: 1px solid white}");

// Copied from MDN https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
let gArc = null;
let gWidgetCont = null;
let gSvg = null;
let glistener = null;
let gArrowCont = null;
let gArcDeg = 2 * 35;

let gCurDir = null;
let gLastPos = null;
let gSkip = false;

const callback = function (mutationsList, observer) {
    for (let mutation of mutationsList) {
        if (mutation.type === "childList") {
            let el = mutation.addedNodes[0];
            if (el && el.tagName === "SCRIPT" && /googleapis/.test(el.src)) {
                observer.disconnect();

                el.addEventListener("load", function () {
                    unsafeWindow.modifyStreeVeiwPanoramaObj();
                    makeWidget();
                });
            }
        }
    }
};

const targetNode = document.head;
const config = { childList: true, subtree: true };
const observer = new MutationObserver(callback);
observer.observe(targetNode, config);

unsafeWindow.modifyStreeVeiwPanoramaObj = function () {
    console.log("modifyStreeVeiwPanoramaObj striaght line mission");

    let oldSVSetPos = google.maps.StreetViewPanorama.prototype.setPosition;

    google.maps.StreetViewPanorama.prototype.setPosition = _setPos;

    function _setPos(...args) {
        // Change back to stock for best preformance.
        //  google.maps.StreetViewPanorama.prototype.setPosition = oldSVSetPos;
        let latLng = null;

        if (gWidgetCont) {
            setTimeout(() => (gWidgetCont.style.display = ""), 1000);
        }

        if (typeof args[0].lat === "function" && gSkip == false) {
            latLng = args[0].toJSON();

            if (gLastPos !== null) {
                const dir = atan2(gLastPos.lat, gLastPos.lng, latLng.lat, latLng.lng);

                const arrowCont = document.querySelector("#arrowCont");

                const lastTransformRotate = arrowCont.style.transform;

                arrowCont.style.transform = `rotate(${360 - dir}deg)`;

                if (!gCurDir) {
                    gCurDir = dir;
                    gSvg.style.display = "";
                    gArc._rotate(360 - dir);
                    google.maps.event.removeListener(glistener);
                    glistener = null;
                    gArrowCont.style.transition = "all ease 100ms";
                }

                if (dir > gCurDir + 35 || dir < gCurDir - 35) {
                    if (
                        !(gCurDir + 35 > 360 && dir < (gCurDir + 35) % 360) &&
                        // Determine if angle has gone past 0 or 360.
                        !(gCurDir - 35 < 0 && dir > gCurDir - 35 + 360)
                    ) {
                        //
                        // Player went out of bounds and needs to be sent to previous pos.
                        //

                        setTimeout(
                            (xy, lastTransformRotate) => {
                                gSkip = false;
                                gLastPos = xy;
                                arrowCont.style.transform = lastTransformRotate;
                            },
                            100,
                            { ...gLastPos },
                            lastTransformRotate
                        );

                        this.setPosition(gLastPos);

                        gSkip = true;
                        gLastPos = null;
                        return;
                    }
                }
            }
        }

        oldSVSetPos.apply(this, args);

        if (latLng && !gSkip) gLastPos = latLng;

        unsafeWindow.__sv = this;
    }
};

function endOfRoundScreenFn() {
    gSvg.style.display = "none";
    gCurDir = null;
    gLastPos = null;
    gSkip = false;
}

// Monitor end of round status.
var round = null;
var endOfRoundObserver = new MutationObserver((mutationRecords) => {
    // console.log(mutationRecords);
    mutationRecords.forEach((record) => {
        if (record.type == "characterData") {
            //     console.log(record);
            let dataqa = record.target.parentElement.parentElement.getAttribute("data-qa");
            if (dataqa === "round-number" || dataqa === "score") {
                endOfRoundScreenFn();
                if (!glistener) {
                    glistener = unsafeWindow.__sv.addListener("pov_changed", (e) => {
                        gArrowCont.style.transform = `rotate(${unsafeWindow.__sv.pov.heading}deg)`;
                        gArrowCont.style.transition = "";
                    });
                }
            }
            return;
        }

        if (record.type == "childList") {
            setTimeout(
                function (removed, added) {
                    removed.forEach((node) => {
                        if (!node.querySelector) {
                            //console.log('removed',node);
                            return;
                        }
                        if (node.querySelector('[data-qa="round-number"]')) {
                            endOfRoundScreenFn();
                            gWidgetCont.style.display = "none";
                            return;
                        }
                    });

                    added.forEach((node) => {
                        if (!node.querySelectorAll) {
                            //console.log('added',node);
                            return;
                        }
                        let buttons = node.querySelectorAll("button");
                        buttons.forEach((button) => {
                            if (/play again/i.test(button.innerHTML)) {
                                endOfRoundScreenFn();
                            }
                        });
                        let anchors = node.querySelectorAll("a");
                        anchors.forEach((anchor) => {
                            if (/play again/i.test(anchor.innerHTML)) {
                                endOfRoundScreenFn();
                            }
                        });
                    });
                },
                100,
                record.removedNodes,
                record.addedNodes
            );
        }
    });
});

endOfRoundObserver.observe(document.body, {
    childList: true,
    characterData: true,
    subtree: true,
});

function makeWidget() {
    const svgns = "http://www.w3.org/2000/svg";

    if (gSvg) {
        gCurDir = null;
        gLastPos = null;
        gSvg.style.display = "none";
        gWidgetCont.style.display = "";

        return;
    }

    let pos = lc.get("pos");
    pos = pos ? pos : { x: 200, y: 200 };

    let arrowCont = document.createElement("div");
    arrowCont.id = "arrowCont";
    arrowCont.style.cssText = `
        height: 200px;
        width: 5px;
       // border: 1px solid red;
        transform: rotate(0deg);
        margin: auto;z-index: 1000; transition: all ease 100ms;
        position: absolute;
        left: 97px;
        top: -1px;`;

    gArrowCont = arrowCont;

    let point = document.createElement("div");
    point.style.cssText = `
        width: 0px;
        height: 0px;
        border-left: 7px solid transparent;
        border-right: 7px solid transparent;
        border-bottom: 11px solid rgb(255, 236, 0);
        transform: translate(-4px, 0px);`;

    arrowCont.appendChild(point);

    let arrowBody = document.createElement("div");
    arrowBody.style.cssText = `
        /*outline: 1px solid red;*/
        background-color: red;
        width: 6px;
        height: 50px;
        border-radius: 10px;`;

    arrowCont.appendChild(arrowBody);

    const scale = lc.get("scale") || 1;

    gWidgetCont = document.createElement("div");
    gWidgetCont.classList.add("hoooover");
    gWidgetCont.__scale = 1;
    gWidgetCont.style.cssText = `
        display:none;
        position: absolute;
        top: ${pos.y}px;
        left: ${pos.x}px;
        height: 201px;
        width: 201px;
        /*border: 1px solid red;*/
        border-radius: 100px;
        transform: scale(${scale});`;

    setTimeout(() => (gWidgetCont.style.display = ""), 1000);

    gWidgetCont.appendChild(arrowCont);

    gSvg = document.createElementNS(svgns, "svg");
    gSvg.setAttribute("viewBox", "0 0 600 600");

    setTimeout(() => {
        gSvg.style.cssText = "overflow: visible; position: absolute; top: 0px; display: none;";
    }, 1000);

    const x = Math.cos((gArcDeg / 360) * (Math.PI * 2)) * 300 + 300;
    const y = 300 - Math.sin((gArcDeg / 360) * (Math.PI * 2)) * 300;

    gArc = document.createElementNS(svgns, "path");
    gArc.setAttribute("d", `M600,300 A300,300 0 0 0 ${x},${y}`);
    gArc.setAttribute("fill", `none`);
    gArc.setAttribute("stroke", `red`);
    gArc.setAttribute("stroke-width", `25`);

    setTimeout(() => {
        gArc.style.cssText = `transform-origin: center;`;
    }, 100);

    gArc._rotate = function (deg) {
        let d = deg + 360 - (90 - ((90 * 70) / 360) * 2);
        gArc.style.transform = `rotate(${d}deg)`;
    };

    gSvg.appendChild(gArc);

    gWidgetCont.appendChild(gSvg);
    document.body.appendChild(gWidgetCont);

    setTimeout(() => {
        if (!glistener) {
            glistener = unsafeWindow.__sv.addListener("pov_changed", (e) => {
                gArrowCont.style.transform = `rotate(${unsafeWindow.__sv.pov.heading}deg)`;
                gArrowCont.style.transition = "";
            });
        }
    }, 1000);

    gWidgetCont.addEventListener("mousedown", function (e) {
        document.body.addEventListener("mousemove", mmove);
        document.body.addEventListener("mouseup", mup);

        let yy = pos.y - e.y;
        let xx = e.x - pos.x;

        function mmove(evt) {
            if (Math.abs(evt.x - e.x) > 2 || Math.abs(evt.y - e.y) > 2) {
                document.body.removeEventListener("mousemove", mmove);
                document.body.addEventListener("mousemove", _mmove);
            }
        }

        function _mmove(evt) {
            gWidgetCont.style.top = evt.y + yy + "px";
            gWidgetCont.style.left = evt.x - xx + "px";
        }

        function mup(evt) {
            document.body.removeEventListener("mousemove", mmove);
            document.body.removeEventListener("mousemove", _mmove);
            document.body.removeEventListener("mouseup", mup);

            if (Math.abs(evt.x - e.x) < 2 && Math.abs(evt.y - e.y) < 2) {
                return;
            }

            pos.x = evt.x - xx;
            pos.y = evt.y + yy;

            lc.set("pos", pos);
        }
    });

    gWidgetCont.addEventListener("wheel", widgetWheel, {once:true});

    function widgetWheel (e) {
        setTimeout(()=>{
            gWidgetCont.addEventListener("wheel", widgetWheel, {once:true});
        }, 50);

        let scale = lc.get("scale") || 1;

        scale += e.deltaY < 0 ? 0.25 : -0.25;
        scale = scale < 0.2 ? 0.2 : scale;

        gWidgetCont.style.transform = `scale(${scale})`;

        lc.set("scale", scale);
    };
}

let lc = {
    get: (prop) => {
        let s = localStorage["straightLine"];
        s = typeof s == "string" ? JSON.parse(s) : {};

        if (prop) {
            return s[prop];
        }

        return s;
    },
    set: (prop, val) => {
        let s = localStorage["straightLine"];
        s = typeof s == "string" ? JSON.parse(s) : {};

        s[prop] = val;

        localStorage["straightLine"] = JSON.stringify(s);
    },
};

function atan2(originY, originX, y, x) {
    let d = Math.atan2(y - originY, x - originX) * (180 / Math.PI) - 90;
    return d > -0.000000000000000001 ? d : d + 360;
}
