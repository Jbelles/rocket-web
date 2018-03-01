import Vue from 'vue';
import $ from 'jquery';
import { Component, Watch, Prop, Emit } from 'vue-property-decorator';
import { EventBus } from '../../../ClientApp/boot'
import StellarSdk from 'stellar-sdk';
import Instascan from 'instascan';
import QRCode from 'qrcode';
import { key } from '../../../environment';
import CryptoJS from "crypto-js";
import jsPDF from 'jspdf';
//StellarSdk.Network.usePublicNetwork();
StellarSdk.Network.useTestNetwork();
class Payment {
    public from: string;
    public amount: number;
    public to: string;
    public created_at: Date;
    public image: HTMLCanvasElement;
    public asset_code: string;
}


@Component
export default class HomeComponent extends Vue {

    found: boolean = false;
    secret: string | null = window.sessionStorage.getItem('secret') != null ? CryptoJS.AES.decrypt(window.sessionStorage.getItem('secret'), key).toString(CryptoJS.enc.Utf8) : null;
    accountId: string | null = window.sessionStorage.getItem('accountId') != null ? CryptoJS.AES.decrypt(window.sessionStorage.getItem('accountId'), key).toString(CryptoJS.enc.Utf8) : null;
    environment: string | null = window.sessionStorage.getItem('environment');
    server: any = new StellarSdk.Server('https://horizon.stellar.org');
    test_server: any = new StellarSdk.Server('https://horizon-testnet.stellar.org');
    loadingWallet: boolean = false;
    paymentHistory: Payment[] = [];
    loadWalletErrorMessage: string = "";
    inflation_destination: string | null = null;
    balances: any[] = [];
    scanning: boolean = false;
    scanner: any;
    currentPrice: number;
    key: string =  key;
    //Functions start here
    @Emit('updateNavbar')
    emitRefreshNavbar() { }

    @Watch('secret')
    onSecretUpdated(val: string, oldVal: string) {
        if (val.length == 56) {
            this.$nextTick(function () {
                this.CheckAccount()
            });
        }
    }
    @Watch('accountId')
    onAccountIdUpdated(val: string, oldVal: string) {
        this.$nextTick(function () {
            var canvas = $(this.GenerateImageBlock(val));
            canvas.prependTo($("#Wallet"));
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
                        element.balance = element.balance + " ($" + (parseFloat(element.balance) * parseFloat(data[0].price_usd)).toFixed(2).toString() + ")";
                    });
            }
        })
    }
    @Watch('paymentHistory')
    onPaymentHistoryUpdated(val: Payment[], oldVal: Payment[]) {
        this.$nextTick(function () {
            this.paymentHistory.forEach(function (payment, index) {
                var canvas = $(payment.image);
                canvas.appendTo($("#payment-" + index));
            });
        var self = this;
        // Tooltips
        // Requires Bootstrap 3 for functionality
        QRCode.toCanvas(document.getElementById('secret-qr'), JSON.stringify({ "stellar": { "account": { network: self.environment == 'test' ? "cee0302d" : '7ac33997'}, "key": self.secret } }), function (error) {
            if (error) console.error(error)
            console.log('success!');
        });
        QRCode.toCanvas(document.getElementById('account-qr'), JSON.stringify({ "stellar": { "account": { network: self.environment == 'test' ? "cee0302d" : '7ac33997' }, "key": self.accountId } }), function (error) {
            if (error) console.error(error)
            console.log('success!');
        });
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
    //@Watch('accountId')
    //onAccountIdChanged(val: string, oldVal: string) {
    //    this.accountId = "123455";
    //}
    showSecretQR() {
        $('#secret-qr').show();
    }
    hideSecretQR() {
        $('#secret-qr').hide();
    }
    showAccountQR() {
        $('#account-qr').show();
    }
    hideAccountQR() {
        $('#account-qr').hide();
    }
    showPDF() {
        let doc = new jsPDF('p', 'pt', 'a4');
        doc.setFont('Helvetica Neue');
        let secret = document.getElementById("secret-qr") as HTMLCanvasElement;
        let account = document.getElementById("account-qr") as HTMLCanvasElement;
        var template = "<html><head></head><body><div style='font: Helvetica Neue;'><div><p><strong>Public Key:</strong></p> {account_key}<img src='{account}'/></div> <div><p><strong>Secret Key:</strong></p> {secret_key}<img src='{secret}'/></div></div><div><p>Generated with Rocket Wallet</p></div></body></html>";

        doc.canvas.height = 72 * 11;
        doc.canvas.width = 72 * 8.5;
        var imgData = secret.toDataURL("image/png");
        template = template.replace('{account_key}', this.accountId!);
        template = template.replace('{secret_key}', this.secret!);
        template = template.replace('{secret}', imgData);
        imgData = account.toDataURL("image/png");
        template = template.replace('{account}', imgData);
        //doc.addImage(imgData, 'JPEG', 15, 40, 180, 180);
        //doc.addImage(imgData, 'JPEG', 15, 40, 180, 180);
        doc.fromHTML(template, 0, 0, {
        }, function () {
            doc.save('paper_wallet.pdf');
        });
        console.log(template);          
    }
    mounted() {
        if (this.secret != null) {
            this.CheckAccount();
            this.$nextTick(function () {
                var canvas = $(this.GenerateImageBlock(this.accountId));
                canvas.prependTo($("#Wallet"));
            });
        }
    }
    endScan() {
        this.scanning = false;
        var self = this;
        setTimeout(function () { self.scanner.stop(); }, 2500);
    }
    Scan() {
        if(this.scanner != null) this.scanner.stop();
        var self = this;
        this.$nextTick(function () {
            self.scanner = new Instascan.Scanner({ video: document.getElementById('preview') });
            self.scanner.addListener('scan', function (content) {
                console.log(content);
                self.scanner.stop();
                self.scanning = false;

                self.secret = JSON.parse(content).stellar.account.id;
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
    GenerateImageBlock(accountId) {
        var icon = createIcon({ // All options are optional
            seed: accountId,  // choose a different background color, default: random
            size: 5, // width/height of the icon in blocks, default: 8
            scale: 5,
        });
        return icon;
    }
    CheckAccount() {

        var self = this;
        this.loadingWallet = true;
        this.loadWalletErrorMessage = "";
        this.paymentHistory = [];
        try {
            var sourceKeys = StellarSdk.Keypair.fromSecret(this.secret);
        }
        catch(error){
            console.error('Something went wrong!', error);
            self.loadWalletErrorMessage = 'Invalid Secret';
            self.loadingWallet = false;
        }

        var payments;
            self.server.loadAccount(sourceKeys.publicKey())
                .catch(StellarSdk.NotFoundError, function (error) {
                    self.test_server.loadAccount(sourceKeys.publicKey()).catch(StellarSdk.NotFoundError, function (test_error) {
                        self.loadWalletErrorMessage = 'Could not find the account';
                        self.loadingWallet = false;
                    }).then(function (account) {
                        self.environment = 'test';
                        window.sessionStorage.setItem('secret', CryptoJS.AES.encrypt(self.secret!, key));
                        window.sessionStorage.setItem('accountId', CryptoJS.AES.encrypt(account.account_id, key));
                        window.sessionStorage.setItem('found', 'true');
                        window.sessionStorage.setItem('environment', 'test');
                        EventBus.$emit('navbarUpdate', account.account_id);
                        self.accountId = account.account_id;
                        self.inflation_destination = account.inflation_destination
                        console.log('Balances for account: ' + sourceKeys.publicKey());
                        account.balances.forEach(function (balance) {
                            console.log('Type:', balance.asset_type, ', Balance:', balance.balance);
                            self.balances.push({ balance: balance.balance, asset_type: balance.asset_type, asset_code: balance.asset_code, asset_issuer: balance.asset_issuer });
                            self.found = true;
                            self.loadWalletErrorMessage = "";
                        });
                        window.sessionStorage.setItem('assets', JSON.stringify(self.balances));
                        }).then(function () {
                            payments = self.test_server.payments().forAccount(sourceKeys.publicKey()).order("desc").limit(100);
                            payments.call().then(function (accountResult) {
                                self.loadingWallet = false;
                                accountResult.records.forEach(function (payment, index) {
                                    // handle a payment
                                    switch (payment.type) {
                                        case "payment": {
                                            self.paymentHistory.push({ from: payment.from, amount: payment.amount, to: payment.to, created_at: payment.created_at, image: self.GenerateImageBlock(payment.from == self.accountId ? payment.to : payment.from), asset_code: payment.asset_code });
                                            break;
                                        }
                                        case "create_account": {
                                            self.paymentHistory.push({ from: payment.source_account, amount: payment.starting_balance, to: payment.account, created_at: payment.created_at, image: self.GenerateImageBlock(payment.source_account == self.accountId ? payment.account : payment.source_account), asset_code: payment.asset_code });
                                            break;
                                        }
                                    }
                                    console.log(payment);
                                });
                            });
                        });
                }).then(function (account) {
                    self.environment = 'live';
                    window.sessionStorage.setItem('secret', CryptoJS.AES.encrypt(self.secret!, key));
                    window.sessionStorage.setItem('accountId', CryptoJS.AES.encrypt(account.account_id, key));
                    window.sessionStorage.setItem('found', 'true');
                    window.sessionStorage.setItem('environment', 'live');
                    EventBus.$emit('navbarUpdate', account.account_id);
                    self.accountId = account.account_id;
                    self.inflation_destination = account.inflation_destination
                    console.log('Balances for account: ' + sourceKeys.publicKey());
                    account.balances.forEach(function (balance) {
                        console.log('Type:', balance.asset_type, ', Balance:', balance.balance);
                        self.balances.push({ balance: balance.balance, asset_type: balance.asset_type, asset_code: balance.asset_code, asset_issuer: balance.asset_issuer });
                        self.found = true;
                        self.loadWalletErrorMessage = "";
                    });
                    window.sessionStorage.setItem('assets', JSON.stringify(self.balances));
                }).then(function () {
                    payments = self.server.payments().forAccount(sourceKeys.publicKey()).order("desc").limit(100);
                    payments.call().then(function (accountResult) {
                        self.loadingWallet = false;
                        accountResult.records.forEach(function (payment, index) {
                            // handle a payment
                            switch (payment.type) {
                                case "payment": {
                                    self.paymentHistory.push({ from: payment.from, amount: payment.amount, to: payment.to, created_at: payment.created_at, image: self.GenerateImageBlock(payment.from == self.accountId ? payment.to : payment.from), asset_code: payment.asset_code });
                                    break;
                                }
                                case "create_account": {
                                    self.paymentHistory.push({ from: payment.source_account, amount: payment.starting_balance, to: payment.account, created_at: payment.created_at, image: self.GenerateImageBlock(payment.source_account == self.accountId ? payment.account : payment.source_account), asset_code: payment.asset_code });
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

