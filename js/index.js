var DEFAULT_API_URL = 'http://localhost:5000';


function resolveMode(u) {
    var url = require('url');
    if(!u.query.hasOwnProperty('mode')) {
        // no mode specified. Reload defaulting to mesh.
        u.query.mode = 'mesh';
        window.location.href = url.format(u);
    } else {
        // TODO add checks for invalid mode here
        return u.query.mode;
    }
}


function resolveServer(u) {
    var Server = require('./app/model/server');
    var apiUrl = DEFAULT_API_URL;
    if (u.query.hasOwnProperty('server')) {
        if (u.query.server === 'demo') {
            // in demo mode and have mode set.
            document.title = document.title + ' - demo mode';
            var $ = require('jquery');
            $('.App-Viewport-UIText-TopLeft').toggle();
            return new Server.Server({DEMO_MODE: true});
        } else {
            apiUrl = 'https://' + u.query.server;
            console.log('Setting server to provided value: ' + apiUrl);
        }
    } // if no server provided use the default
    return new Server.Server({apiURL: apiUrl});
}


document.addEventListener('DOMContentLoaded', function () {
    var $ = require('jquery');
    var SidebarView = require('./app/view/sidebar');
    var AssetView = require('./app/view/asset');
    var ToolbarView = require('./app/view/toolbar');
    var ViewportView = require('./app/view/viewport');
    var Notification = require('./app/view/notification');
    var App = require('./app/model/app');
    var THREE = require('three');
    var url = require('url');

    // allow CORS loading of textures
    // https://github.com/mrdoob/three.js/issues/687
    THREE.ImageUtils.crossOrigin = "";

    // Parse the current url so we can query the parameters
    var u = url.parse(window.location.href, true);
    u.search = null;  // erase search so query is used in building back URL

    var mode = resolveMode(u);
    // by this point definitely have a mode set.
    var server = resolveServer(u);
    // by this point definitely have a correctly set server.

    var app = new App.App({server: server, mode: mode});
    var preview = new Notification.ThumbnailNotification({model:app});
    var sidebar = new SidebarView.Sidebar({model: app});
    var assetView = new AssetView.AssetView({model: app});
    var viewport = new ViewportView.Viewport({model: app});
    var toolbar = new ToolbarView.Toolbar({model: app});

    // For debugging, attach to the window.
    window.app = app;
    window.toolbar = toolbar;

    // ----- KEYBOARD HANDLER ----- //
    $(window).keypress(function(e) {
        var key = e.which;
        switch (key) {
            case 100:  // d
                app.landmarks().deleteSelected();
                break;
            case 32:  // space bar = reset camera
                // TODO fix for multiple cameras (should be in camera controller)
                viewport.resetCamera();
                break;
            case 116:  // t = [T]exture toggle (mesh mode only)
                if (app.meshMode()) {
                    app.mesh().textureToggle();
                }
                break;
            case 119:  // w = [W]ireframe toggle (mesh mode only)
                if (app.meshMode()) {
                    app.mesh().wireframeToggle();
                }
                break;
            case 97:  // a = select [A]ll
                app.landmarks().selectAllInActiveGroup();
                break;
            case 99:  // a = toggle [C]amera mode
                if (app.meshMode()) {
                    viewport.toggleCamera();
                }
                break;
            case 106:  // j = down, next asset
                app.assetSource().next();
                break;
            case 107:  // k = up, previous asset
                app.assetSource().previous();
                break;
        }
    });
});
