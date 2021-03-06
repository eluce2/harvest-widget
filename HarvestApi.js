
let account_id, access_token, widget

class Harvest {
    constructor() {
        this.baseUrl = 'https://api.harvestapp.com/v2/'
        this.user_id = null
    }
    async initCreds() {
        if (!Keychain.contains("harvestAccountID") || !Keychain.contains("harvestAccessToken")) {
            await this.requestCreds()
        }
        this.account_id = Keychain.get("harvestAccountID")
        this.access_token = Keychain.get("harvestAccessToken")
    }
    async requestCreds() {
        if (config.runsInWidget) {
            // cannot show alerts, in widget, display the error widget instead
            let error = {
                "error": "Missing Credentials",
                "error_description": "Run this script first to setup your Harvest Credentials"
            }
            widget = await errorWidget(error)
            Script.setWidget(widget)
            Script.complete()
            return
        }
    
        let alert = new Alert()
        alert.title = "Missing Credentials"
        alert.message = "Enter your Harvest Credentials below."
        alert.addTextField("Account ID")
        alert.addSecureTextField("Access Token")
        alert.addAction("OK")
        alert.addCancelAction("Cancel")
        let result = await alert.present()
        if (result == -1) throw 'user_cancel' // user cancel
    
        account_id = alert.textFieldValue(0)
        if (account_id == "") throw 'invalid_account_id' // must not be empty
    
        access_token = alert.textFieldValue(1)
        if (access_token == "") throw 'invalid_access_token' // must not be empty
    
        Keychain.set("harvestAccountID", account_id)
        Keychain.set("harvestAccessToken", access_token)
    }

    async _callHarvestAPI(endpoint, method="POST") {
        let req = new Request(this.baseUrl + endpoint)
        req.headers = { "Harvest-Account-Id": this.account_id, "Authorization": "Bearer " + this.access_token }
        let json = await req.loadJSON()
        if (json.error) {
            throw new Error(`Harvest API Error: ${json.error}`)
        }
        return json
    }

    async _returnUserID() {
        if (this.user_id !== null) return this.user_id
        let json = await this._callHarvestAPI('users/me')
        this.user_id = json.id
        return this.user_id
    }

    async getMyTimeEntries(from, to) {
        from = this.formatDate(from)
        to = this.formatDate(to)
        let user_id = await this._returnUserID()
        let page = 1
        let result
        let fullList = []

        while(true) {
            let endpoint = `time_entries?from=${from}&to=${to}&user_id=${user_id}&page=${page}`
            result = await this._callHarvestAPI(endpoint)
            fullList = fullList.concat(result.time_entries)
            page = result.next_page   
            if (page === null) break
        }
        this.fullList = fullList
        return this.fullList
    }

    formatDate(d) {
        let day = d.getDate()
        let month = d.getMonth() + 1
        let year = d.getFullYear()
        if (day < 10) day = "0" + day
        if (month < 10) month = "0" + month
        return `${year}-${month}-${day}`
    }
}

module.exports = Harvest