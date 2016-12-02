import * as url from 'url'
import * as Backbone from 'backbone'
import { App } from '../model/app'

export class URLState extends Backbone.View<App> {

    constructor(model: App) {
        super({ model })
        console.log('HistoryUpdate:initialize')
        this.listenTo(this.model, "change:asset", this.assetChanged)
        this.listenTo(this.model, "change:activeTemplate", this.assetChanged)
        // note that we don't listen for a change in the collection as
        // this could lead to an invalid URL (e.g. change the collection to
        // something else, URL immediately changes, user saves before asset
        // loads)
    }

    assetChanged = () => {
        var u = url.parse(window.location.href.replace('#', '?'), true)
        u.search = null

        if (this.model.activeTemplate) {
            u.query.t = this.model.activeTemplate
        }

        if (this.model.activeCollection) {
            u.query.c = this.model.activeCollection
        }

        if (this.model.assetIndex !== undefined) {
            u.query.i = this.model.assetIndex + 1
        }

        history.replaceState(null, null, url.format(u).replace('?', '#'))
    }

}
