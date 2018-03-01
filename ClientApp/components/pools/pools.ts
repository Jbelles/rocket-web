import Vue from 'vue';
import { Component, Watch } from 'vue-property-decorator';
import Instascan from 'instascan';
import StellarSdk from 'stellar-sdk';
interface Pool {
    Votes: number;
}

@Component
export default class PoolsComponent extends Vue {
    pool: Pool | null = null;
    pool_id: string = "";
    pool_found: boolean = false;
    pool_error: string = "";
    loading: boolean = false;
    scanning: boolean = false;
    scanner: any;

    @Watch('pool_id')
    onPoolIdUpdated(val: string, oldVal: string) {
        if (val.length == 56) {
            this.$nextTick(function () {
                this.loading = true;
                this.GetPoolVotes();
            });
            this.pool_error = '';
        }
        else if (val.indexOf('*') > -1 && val.indexOf('.') > -1) {
            var account = val.split('*');
            if (account.length > 1) {
                var self = this;
                StellarSdk.StellarTomlResolver.resolve(account[1])
                    .then(stellarToml => {
                        self.pool_id = 'Loading...';
                        fetch(stellarToml.FEDERATION_SERVER + '?q=' + val + '&type=name')
                            .then(response => response.json())
                            .then(data => {
                                self.pool_id = data.account_id;
                                self.pool_error = '';
                            });
                    }).catch(function (e) {
                        //self.pool_error = "Can't find the specified federation address";
                    });
            }
        }
        else if (val.length != 0) {
            this.pool_error = "Invalid Account Id Format";
            this.pool = null;
        }
        else {
            this.pool_error = "";
            this.pool = null;
        }
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

                self.pool_id = JSON.parse(content).stellar.account.id;
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
    GetPoolVotes() {
        var self = this;
        fetch('api/Stellar/GetVotes/' + this.pool_id)
            .then(response => response.json() as Promise<Pool>)
            .then(data => {
                this.pool = data;
                this.loading = false;
            });
    }
    mounted() {

    }
}
