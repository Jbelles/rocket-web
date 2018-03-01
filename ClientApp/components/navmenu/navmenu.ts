import Vue from 'vue';
import $ from 'jquery';
import { Component, Watch } from 'vue-property-decorator';
import { EventBus } from '../../../ClientApp/boot'
import CryptoJS from "crypto-js";
import { key } from '../../../environment';

@Component
export default class NavComponent extends Vue {
    found: string | null = window.sessionStorage.getItem('found');
    secret: string | null = window.sessionStorage.getItem('secret') != null ? CryptoJS.AES.decrypt(window.sessionStorage.getItem('secret'), key).toString(CryptoJS.enc.Utf8) : null;
    accountId: string | null = window.sessionStorage.getItem('accountId') != null ? CryptoJS.AES.decrypt(window.sessionStorage.getItem('accountId'), key).toString(CryptoJS.enc.Utf8) : null;


    created() {
        var self = this;
        EventBus.$on('navbarUpdate', function (accountId) {
            if (self.accountId == null) {
                self.$nextTick(function () {
                    self.accountId = accountId;
                    var canvas = $(self.GenerateImageBlock(accountId));
                    canvas.appendTo($("#wallet-nav"));
                });
            }
        });

        if (this.accountId != null) {
            this.$nextTick(function () {
                var canvas = $(this.GenerateImageBlock(this.accountId));
                canvas.appendTo($("#wallet-nav"));
            });
        }
        self.$nextTick(function () {
            $('.js-tooltip').tooltip();

            // Copy to clipboard
            // Grab any text in the attribute 'data-copy' and pass it to the 
            // copy function
            $('.js-copy').click(function (this) {
                var text = $(this).attr('data-copy');
                var el = $(this);
                self.copyToClipboard(text, el);
            });
        });
    }
    GenerateImageBlock(accountId) {
        var icon = createIcon({ // All options are optional
            seed: accountId,  // choose a different background color, default: random
            size: 5, // width/height of the icon in blocks, default: 8
            scale: 5,
        });
        return icon;
    }
    copyToClipboard(text, el) {
        var copyTest = document.queryCommandSupported('copy');
        var elOriginalText = el.attr('data-original-title');

        if (copyTest === true) {
            var copyTextArea = document.createElement("textarea");
            copyTextArea.value = text;
            document.body.appendChild(copyTextArea);
            copyTextArea.select();
            try {
                var successful = document.execCommand('copy');
                var msg = successful ? 'Copied!' : 'Whoops, not copied!';
                el.attr('data-original-title', msg).tooltip('show');
            } catch (err) {
                console.log('Oops, unable to copy');
            }
            document.body.removeChild(copyTextArea);
            el.attr('data-original-title', elOriginalText);
        } else {
            // Fallback if browser doesn't support .execCommand('copy')
            window.prompt("Copy to clipboard: Ctrl+C or Command+C, Enter", text);
        }
    }


}

var randseed = new Array(4); // Xorshift: [x, y, z, w] 32 bit values

function seedrand(seed) {
    for (var i = 0; i < randseed.length; i++) {
        randseed[i] = 0;
    }
    for (var i = 0; i < seed.length; i++) {
        randseed[i % 4] = ((randseed[i % 4] << 5) - randseed[i % 4]) + seed.charCodeAt(i);
    }
}

function rand() {
    // based on Java's String.hashCode(), expanded to 4 32bit values
    var t = randseed[0] ^ (randseed[0] << 11);

    randseed[0] = randseed[1];
    randseed[1] = randseed[2];
    randseed[2] = randseed[3];
    randseed[3] = (randseed[3] ^ (randseed[3] >> 19) ^ t ^ (t >> 8));

    return (randseed[3] >>> 0) / ((1 << 31) >>> 0);
}

function createColor() {
    //saturation is the whole color spectrum
    var h = Math.floor(rand() * 360);
    //saturation goes from 40 to 100, it avoids greyish colors
    var s = ((rand() * 60) + 40) + '%';
    //lightness can be anything from 0 to 100, but probabilities are a bell curve around 50%
    var l = ((rand() + rand() + rand() + rand()) * 25) + '%';

    var color = 'hsl(' + h + ',' + s + ',' + l + ')';
    return color;
}

function createImageData(size) {
    var width = size; // Only support square icons for now
    var height = size;

    var dataWidth = Math.ceil(width / 2);
    var mirrorWidth = width - dataWidth;

    var data = [] as number[];
    for (var y = 0; y < height; y++) {
        var row = [] as number[];
        for (var x = 0; x < dataWidth; x++) {
            // this makes foreground and background color to have a 43% (1/2.3) probability
            // spot color has 13% chance
            row[x] = Math.floor(rand() * 2.3);
        }
        var r = row.slice(0, mirrorWidth);
        r.reverse();
        row = row.concat(r);

        for (var i = 0; i < row.length; i++) {
            data.push(row[i]);
        }
    }

    return data;
}

function createCanvas(imageData, color, scale, bgcolor, spotcolor) {
    var c = document.createElement('canvas');
    var width = Math.sqrt(imageData.length);
    c.width = c.height = width * scale;
    var cc = c.getContext('2d');
    cc!.fillStyle = bgcolor;
    cc!.fillRect(0, 0, c.width, c.height);
    cc!.fillStyle = color;

    for (var i = 0; i < imageData.length; i++) {
        var row = Math.floor(i / width);
        var col = i % width;
        // if data is 2, choose spot color, if 1 choose foreground
        cc!.fillStyle = (imageData[i] == 1) ? color : spotcolor;

        // if data is 0, leave the background
        if (imageData[i]) {
            cc!.fillRect(col * scale, row * scale, scale, scale);
        }
    }

    return c;
}

function createIcon(opts) {
    opts = opts || {};
    var size = opts.size || 8;
    var scale = opts.scale || 4;
    var seed = opts.seed || Math.floor((Math.random() * Math.pow(10, 16))).toString(16);

    seedrand(seed);

    var color = opts.color || createColor();
    var bgcolor = opts.bgcolor || createColor();
    var spotcolor = opts.spotcolor || createColor();
    var imageData = createImageData(size);
    var canvas = createCanvas(imageData, color, scale, bgcolor, spotcolor);

    return canvas;
}

