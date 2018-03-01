import Vue from 'vue';
import { Component } from 'vue-property-decorator';
import $ from 'jquery';
import StellarSdk from 'stellar-sdk';

@Component
export default class CreateComponent extends Vue {
    server: any = new StellarSdk.Server('https://horizon-testnet.stellar.org');
    secret: string = "";
    accountId: string = "";
    created: boolean = false;

    mounted() {
        var self = this;
        $('.js-tooltip').tooltip();

        // Copy to clipboard
        // Grab any text in the attribute 'data-copy' and pass it to the 
        // copy function
        $('.js-copy').click(function (this) {
            var text = $(this).attr('data-copy');
            var el = $(this);
            self.copyToClipboard(text, el);
        });
    }
    CreateStellarAccount() {
        var pair = StellarSdk.Keypair.random();

        this.secret = pair.secret();
        this.accountId = pair.publicKey();
        this.created = true;

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
