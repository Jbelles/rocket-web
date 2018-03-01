import Vue from 'vue';
import StellarSdk from 'stellar-sdk';
import { Component, Watch } from 'vue-property-decorator';
import $ from 'jquery';
import Instascan from 'instascan';
import { key } from '../../../environment';
import CryptoJS from "crypto-js";

@Component
export default class SendComponent extends Vue {

    secret: string | null = window.sessionStorage.getItem('secret') != null ? CryptoJS.AES.decrypt(window.sessionStorage.getItem('secret'), key).toString(CryptoJS.enc.Utf8) : null;
    accountId: string | null = window.sessionStorage.getItem('accountId') != null ? CryptoJS.AES.decrypt(window.sessionStorage.getItem('accountId'), key).toString(CryptoJS.enc.Utf8) : null;
    assets: any = JSON.parse(window.sessionStorage.getItem('assets')!);
    environment: string | null = window.sessionStorage.getItem('environment');
    destinationId: string |null = null;
    amount: number | null = null;
    sending: boolean = false;
    sent: boolean = false;
    tran: any | null = null;
    errorMessage: string | null = null;
    createPrompt: boolean | null = null;
    currentAsset: any = StellarSdk.Asset.native();
    scanning: boolean = false;
    scanner: any;
    server: any = this.environment == 'test' ? new StellarSdk.Server('https://horizon-testnet.stellar.org') : new StellarSdk.Server('https://horizon.stellar.org');
    currentPrice: number | null = null;


    @Watch('destinationId')
    onDestinationSet(val: string, oldVal: string) {
        $("#destinationAddress").children("canvas").remove();
        if (val != null && val.length == 56) {
            this.$nextTick(function () {
                var canvas = $(this.GenerateImageBlock(val));
                canvas.appendTo($("#destinationAddress"));
            });
        }
        else if (val.indexOf('*') > -1 && val.indexOf('.') > -1) {
            var account = val.split('*');
            if (account.length > 1) {
                var self = this;
                StellarSdk.StellarTomlResolver.resolve(account[1])
                    .then(stellarToml => {
                        self.errorMessage = null;
                        self.destinationId = 'Loading...';
                        fetch(stellarToml.FEDERATION_SERVER + '?q=' + val + '&type=name')
                            .then(response => response.json())
                            .then(data => {
                                self.destinationId = data.account_id;
                                self.errorMessage = null;
                            });
                    }).catch(function (e) {
                      //  self.errorMessage = "Can't find the specified federation address";
                    });
            }
        }
    }
    @Watch('tran')
    OnSent(val: any, oldVal: any) {
        if (val != null) {
            var self = this;
            this.$nextTick(function () {
            $('#link').tooltip();

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
    }
    @Watch('amount')
    onAmountUpdated(val: string, oldVal: string) {
        this.errorMessage = null;
        this.createPrompt = null;


        if (oldVal == null) {
            if (this.currentAsset.code == 'XLM') {
                var self = this;
                fetch('https://api.coinmarketcap.com/v1/ticker/stellar/')
                    .then(response => response.json())
                    .then(data => {
                        self.currentPrice = data[0].price_usd;
                    });
            }
        }
    }
    created() {
        if (this.environment == 'test') {
            StellarSdk.Network.useTestNetwork();
        }
        else {
            StellarSdk.Network.usePublicNetwork();
        }
    }
    SetAsset(asset) {
        this.currentAsset = asset.asset_type == 'native' ? StellarSdk.Asset.native() : new StellarSdk.Asset(asset.asset_code, asset.asset_issuer);
    }
    GenerateImageBlock(accountId) {
        var icon = createIcon({ // All options are optional
            seed: accountId,  // choose a different background color, default: random
            size: 5, // width/height of the icon in blocks, default: 8
            scale: 5,
        });
        return icon;
    }
    endScan() {
        this.scanning = false;
        var self = this;
        setTimeout(function () { self.scanner.stop(); }, 2500);
    }
    Scan() {
        if (this.scanner != null) this.scanner.stop();
        var self = this;
        this.$nextTick(function () {
            self.scanner = new Instascan.Scanner({ video: document.getElementById('preview') });
            self.scanner.addListener('scan', function (content) {
                console.log(content);
                self.scanner.stop();
                self.scanning = false;

                self.destinationId = JSON.parse(content).stellar.account.id;
            });
            Instascan.Camera.getCameras().then(function (cameras) {
                if (cameras.length > 0) {
                    self.scanning = true;
                    self.scanner.start(cameras[0]);
                } else {
                    console.error('No cameras found.');
                }
            }).catch(function (e) {
                console.error(e);
                self.scanner.stop();
            });
        });
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
    Create() {
        this.createPrompt = null;
        this.sending = true;
        if (this.currentAsset.code == 'XLM' && (this.amount == null || this.amount! < 1.00001)) {
            this.errorMessage = "Initial balance must be at least 1.00001 Lumens";
            throw new Error('Initial balance must be at least 1.00001 Lumens');
        }
        var self = this;
        return this.server.loadAccount(this.accountId)
            .then(source => {
                let tx = new StellarSdk.TransactionBuilder(source)
                    .addOperation(StellarSdk.Operation.createAccount({
                        destination: self.destinationId,
                        startingBalance: self.amount
                    }))
                    .addMemo(StellarSdk.Memo.text('Rocket Powered'))
                    .build();

                tx.sign(StellarSdk.Keypair.fromSecret(self.secret));

                return this.server.submitTransaction(tx);
            })
            .then(function (result) {
                self.sent = true;
                self.sending = false;
                self.destinationId = null;
                self.amount = null;
                console.log('Success! Results:', result);
                self.tran = result;
            })
            .catch(function (error) {
                self.sent = false;
                self.sending = false;
                self.createPrompt = false;
                self.errorMessage = error.message;
        });
    }
    Send() {
        if (this.destinationId == null) {
            this.errorMessage = "No destination set.";
            throw new Error('No destination set');
        }
        else if (this.currentAsset.code == 'XLM' &&(this.amount == null || this.amount! < .0000100)) {
            this.errorMessage = 'Amount must be at least 100 stroops. (.0000100 Lumens)';
            throw new Error('Amount must be at least 100 stroops. (.0000100 Lumens)')
        }
        else if (this.destinationId.length != 56) {
            this.errorMessage = "Invalid Public Key";
            throw new Error('Invalid Public Key')
        }
        this.errorMessage = null;
        var sourceKeys = StellarSdk.Keypair
            .fromSecret(this.secret);

        var self = this;
        var transaction;
        self.sending = true;
        
        this.server.loadAccount(this.destinationId)
             //If the account is not found, surface a nicer error message for logging.
            .catch(StellarSdk.NotFoundError, function (error) {
                self.sending = false;
                self.createPrompt = true;
                console.warn('Destination account does not yet exist');
                throw new Error('Destination account does not yet exist');
            })
             //If there was no error, load up-to-date information on your account.
            .then(function () {
                return self.server.loadAccount(sourceKeys.publicKey())
            })
            .then(function (sourceAccount) {
                // Start building the transaction.
                transaction = new StellarSdk.TransactionBuilder(sourceAccount)
                    .addOperation(StellarSdk.Operation.payment({
                        destination: self.destinationId,
                        // Because Stellar allows transaction in many currencies, you must
                        // specify the asset type. The special "native" asset represents Lumens.
                        asset: self.currentAsset,
                        amount: self.amount
                    }))
                    // A memo allows you to add your own metadata to a transaction. It's
                    // optional and does not affect how Stellar treats the transaction.
                    .addMemo(StellarSdk.Memo.text('Rocket Powered'))
                    .build();
                // Sign the transaction to prove you are actually the person sending it.
                transaction.sign(sourceKeys);
                // And finally, send it off to Stellar!

                return self.server.submitTransaction(transaction);
            })
            .then(function (result) {
                self.sent = true;
                self.sending = false;
                self.destinationId = null;
                self.amount = null;
                console.log('Success! Results:', result);
                self.tran = result;
            })
            .catch(function (error) {
                console.error('Something went wrong!', error);
                self.sending = false;
                self.errorMessage = error.message;
                // If the result is unknown (no response body, timeout etc.) we simply resubmit
                // already built transaction:
                // server.submitTransaction(transaction);
            });
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
