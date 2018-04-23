import Vue from 'vue';
import StellarSdk from 'stellar-sdk';
import $ from 'jquery';
import { Component, Watch } from 'vue-property-decorator';
import Instascan from 'instascan';

class Payment {
    public from: string;
    public amount: number;
    public to: string;
    public created_at: Date;
    public image: HTMLCanvasElement;
    public asset_code: string;
}

@Component
export default class AccountComponent extends Vue {
    server: any = new StellarSdk.Server('https://horizon.stellar.org');
    test_server: any = new StellarSdk.Server('https://horizon-testnet.stellar.org');
    secret: string = "";
    accountId: string = "";
    destinationId: string = "";
    destinationBalance: number | null = null;
    destinationFound: boolean = false;
    paymentHistory: Payment[] = [];
    inflation_destination: string | null = null;
    loadingAccount: boolean | null = false;
    loadWalletErrorMessage: string | null = null;
    balances: any[] = [];
    environment: string | null;
    scanning: boolean = false;
    scanner: any;
    currentPrice: number;

    @Watch('destinationId')
    onDestinationUpdated(val: string, oldVal: string) {
        this.paymentHistory = [];
        this.balances = [];
        this.destinationFound = false;
        this.environment = null;
        if (val.length == 56) {
            this.loadWalletErrorMessage = null;
            $("#Wallet").children("canvas").remove();
            this.$nextTick(function () {
                var canvas = $(this.GenerateImageBlock(val));
                canvas.prependTo($("#Wallet"));
            });
            this.$nextTick(function () {
                this.LookupAccount()
            });
        }
        else if (val.indexOf('*') > -1 && val.indexOf('.') > -1) {
            var account = val.split('*');
            if (account.length > 1) {
                var self = this;
                StellarSdk.StellarTomlResolver.resolve(account[1])
                    .then(stellarToml => {
                        self.loadWalletErrorMessage = null;
                        self.destinationId = 'Loading...';
                        fetch(stellarToml.FEDERATION_SERVER + '?q=' + val + '&type=name')
                            .then(response => response.json())
                            .then(data => {
                                self.destinationId = data.account_id;
                                self.loadWalletErrorMessage = null;
                            });
                    }).catch(function (e) {
                       // self.loadWalletErrorMessage = "Can't find the specified federation address";
                    });
            }
        }
        else {
            this.paymentHistory = [];
            this.destinationFound = false;
            this.destinationBalance = null;
            this.inflation_destination = null;
            if (val.length != 0)
                this.loadWalletErrorMessage = "Invalid Public Key Format";
            else
                this.loadWalletErrorMessage = null;
        }
    }

    @Watch('paymentHistory')
    onPaymentHistoryUpdated(val: Payment[], oldVal: Payment[]) {
        this.$nextTick(function () {
            this.paymentHistory.forEach(function (payment, index) {
                var canvas = $(payment.image);
                canvas.appendTo($("#payment-" + index));
            });
            $('.js-tooltip').tooltip();

            // Copy to clipboard
            // Grab any text in the attribute 'data-copy' and pass it to the 
            // copy function
            var self = this;
            $('.js-copy').click(function (this) {
                var text = $(this).attr('data-copy');
                var el = $(this);
                self.copyToClipboard(text, el);
            });
        });
    }
    @Watch('balances')
    onBalancesUpdated(val: any, oldVal: any) {
        var self = this;
        val.forEach(function (element) {
            if (element.asset_type == 'native') {
                fetch('https://api.coinmarketcap.com/v1/ticker/stellar/')
                    .then(response => response.json())
                    .then(data => {
                        self.currentPrice = data[0].price_usd;
                        element.balance = element.balance + " ($" + (parseFloat(element.balance) * parseFloat(data[0].price_usd)).toFixed(2).toString() + " USD)";
                    });
            }
        })
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
        this.scanning = true;
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
    LookupAccount() {
        var self = this;
        self.loadingAccount = true;

        var payments;
        self.server.loadAccount(self.destinationId)
            // If the account is not found, surface a nicer error message for logging.
            .catch(StellarSdk.NotFoundError, function (error) {
                //self.loadWalletErrorMessage = 'Account does not exist';
                //throw new Error('The destination account does not exist!');
                self.test_server.loadAccount(self.destinationId)
                    // If the account is not found, surface a nicer error message for logging.
                    .catch(StellarSdk.NotFoundError, function (error) {
                        self.loadWalletErrorMessage = 'Account does not exist';
                        throw new Error('The destination account does not exist!');
                    }).then(function (account) {
                        window.sessionStorage.setItem('found', 'true');
                        self.environment = 'test';
                        self.inflation_destination = account.inflation_destination
                        account.balances.forEach(function (balance) {
                            console.log('Type:', balance.asset_type, ', Balance:', balance.balance);
                            self.balances.push({ balance: balance.balance, asset_type: balance.asset_type, asset_code: balance.asset_code, asset_issuer: balance.asset_issuer });
                            self.destinationFound = true;
                        });
                    }).then(function (account) {
                        payments = self.test_server.payments().forAccount(self.destinationId).order("desc").limit(100);
                        payments.call().then(function (accountResult) {
                            self.loadingAccount = false;
                            accountResult.records.forEach(function (payment, index) {
                                switch (payment.type) {
                                    case "payment": {
                                        self.paymentHistory.push({ from: payment.from, amount: payment.amount, to: payment.to, created_at: payment.created_at, image: self.GenerateImageBlock(payment.from == self.destinationId ? payment.to : payment.from), asset_code: payment.asset_code });
                                        break;
                                    }
                                    case "create_account": {
                                        self.paymentHistory.push({ from: payment.source_account, amount: payment.starting_balance, to: payment.account, created_at: payment.created_at, image: self.GenerateImageBlock(payment.source_account == self.destinationId ? payment.account : payment.source_account), asset_code: payment.asset_code });
                                        break;
                                    }
                                }
                                console.log(payment);
                            });
                        });
                    });
            }).then(function (account) {
                window.sessionStorage.setItem('found', 'true');
                self.inflation_destination = account.inflation_destination
                account.balances.forEach(function (balance) {
                    console.log('Type:', balance.asset_type, ', Balance:', balance.balance);
                    self.balances.push({ balance: balance.balance, asset_type: balance.asset_type, asset_code: balance.asset_code, asset_issuer: balance.asset_issuer });
                    self.destinationFound = true;
                });
            }).then(function (account) {
                payments = self.server.payments().forAccount(self.destinationId).order("desc").limit(100);
                payments.call().then(function (accountResult) {
                    self.loadingAccount = false;
                    accountResult.records.forEach(function (payment, index) {
                        switch (payment.type) {
                            case "payment": {
                                self.paymentHistory.push({ from: payment.from, amount: payment.amount, to: payment.to, created_at: payment.created_at, image: self.GenerateImageBlock(payment.from == self.destinationId ? payment.to : payment.from), asset_code: payment.asset_code });
                                break;
                            }
                            case "create_account": {
                                self.paymentHistory.push({ from: payment.source_account, amount: payment.starting_balance, to: payment.account, created_at: payment.created_at, image: self.GenerateImageBlock(payment.source_account == self.destinationId ? payment.account : payment.source_account), asset_code: payment.asset_code });
                                break;
                            }
                        }
                        console.log(payment);
                    });
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