'use strict';

import _ from 'underscore';
import Backbone from 'backbone';
import $ from 'jquery';

import download from '../lib/download';
import atomic from '../model/atomic';
import TemplatePanel from './templates';

// Renders a single Landmark. Should update when constituent landmark
// updates and that's it.
export const LandmarkView = Backbone.View.extend({

    tagName: "div",

    events: {
        click: "handleClick"
    },

    initialize: function ({labelIndex}) {
        this.listenTo(this.model, 'change', this.render);
        _.bindAll(this, 'select', 'selectGroup', 'handleClick', 'selectAll');
        this._clickedTimeout = null;
        this.labelIndex = labelIndex;

    },

    render: function () {
        const html = $("<div></div>");
        html.addClass("Lm", this.model.isEmpty());
        var indx = parseInt(this.model.attributes.index);
        html.html('<div class="LM-Value-Label">' + indx.toString() + '</div>');
        html.toggleClass("Lm-Empty", this.model.isEmpty());
        html.toggleClass("Lm-Value", !this.model.isEmpty());
        html.toggleClass("Lm-Selected", this.model.isSelected());
        html.toggleClass("Lm-NextAvailable", this.model.isNextAvailable());
        // in case our element is already live replace the content
        this.$el.replaceWith(html);
        // now set the element back so we have a handle. If this is the
        // first time then we have gotten a handle for the future
        this.setElement(html);
        return this;
    },

    handleClick: function (event) {
        if (this._clickedTimeout === null) {
            this._clickedTimeout = setTimeout(() => {
                this._clickedTimeout = null;
                this.select(event);
            }, 200);
        } else {
            clearTimeout(this._clickedTimeout);
            this._clickedTimeout = null;
            this.selectGroup(event);
        }
    },

    select: atomic.atomicOperation(function (event) {
        if (event.shiftKey) {
            this.selectAll(event);
        } else if (this.model.isSelected()) {
            this.model.deselect();
        } else if (event.ctrlKey || event.metaKey) {
            if (!this.model.isSelected()) {
                this.model.select();
                $('#viewportContainer').trigger("groupSelected");
            }
        } else if (this.model.isEmpty()) {
            // user is clicking on an empty landmark - mark it as the next for
            // insertion
            this.model.setNextAvailable();
        } else {
            this.model.selectAndDeselectRest();
        }
    }),

    selectGroup: function () {
        this.model.group().deselectAll();
        this.model.group().labels[this.labelIndex].selectAll();
        $('#viewportContainer').trigger("groupSelected");
    },

    selectAll: function () {
        this.model.group().selectAll();
        $('#viewportContainer').trigger("groupSelected");
    }
});

// Renders the LandmarkList. Don't think this ListView should ever have to
// render (as we build a fresh View each time a group is activated
// and de-activated)
export const LandmarkListView = Backbone.View.extend({

    tagName: 'div',

    initialize: function ({labelIndex}) {
        _.bindAll(this, 'render', 'renderOne');
        this.lmViews = [];
        this.labelIndex = labelIndex;
        this.render();

    },

    render: function() {
        this.cleanup();
        this.$el.empty();
        this.$el.addClass('LmGroup-Flex');
        this.collection.map(this.renderOne);
        return this;
    },

    renderOne: function(model) {
        const lm = new LandmarkView({model, labelIndex: this.labelIndex});
        // reset the view's element to it's template
        this.$el.append(lm.render().$el);
        this.lmViews.push(lm);
        return this;
    },

    cleanup: function () {
        this.lmViews.forEach(function (lm) { lm.remove(); });
        this.lmViews = [];
    }

});

export const LandmarkGroupLabelView = Backbone.View.extend({

    className: "LmGroup-Label",

    initialize: function () {
        this.$el.html(this.model.label);
    }
});

// Renders a single LandmarkGroup. Either the view is closed and we just
// render the header (LandmarkGroupButtonView) or this group is active and
// we render all the landmarks (LandmarkListView) as well as the header.
export const LandmarkGroupView = Backbone.View.extend({

    tagName: 'div',

    initialize: function({labelIndex}) {
        _.bindAll(this, 'render');
        this.landmarkList = null;
        this.label = null;
        this.labelIndex = labelIndex;
        this.render();
    },

    render: function () {
        this.cleanup();
        this.$el.empty();
        this.$el.addClass('LmGroup');

        let points = this.model.landmarks.length;

        showNewElements();
        if(points != 93 && points != 68) {
            hideNewElements();
        }

        this.landmarkList = new LandmarkListView(
            {collection: this.model.landmarks, labelIndex: this.labelIndex});
        this.label = new LandmarkGroupLabelView({model: this.model});
        this.$el.append(this.label.render().$el);
        this.$el.append(this.landmarkList.render().$el);
        return this;
    },

    cleanup: function () {
        if (this.landmarkList) {
            // already have a list view! clean it up + remove
            this.landmarkList.cleanup();
            this.landmarkList.remove();
            this.landmarkList = null;
        }
        if (this.label) {
            // already have a label view! remove
            this.label.remove();
            this.label = null;
        }
    }
});

// Renders a collection of LandmarkGroups. At any one time one of these
// will be expanded - the rest closed. This View is indifferent - it just
// builds LandmarkGroupView's and asks them to render in turn.
export const LandmarkGroupListView = Backbone.View.extend({

    initialize: function () {
        _.bindAll(this, 'render', 'renderOne');
        this.groups = [];
        this.render();


        this.changeTabsListener = _.extend({}, Backbone.Events);
        this.changeTabsListener.listenTo(Backbone, 'redrawCols', (lms)=>{
            this.collection[0] = lms.label;
            this.render();
        });

    },

    render: function() {
        this.cleanup();
        this.$el.empty();
        this.collection.map(this.renderOne);
        if (this.collection.length === 1) {
            this.$el.find('.LmGroup-Flex').addClass('MultiLine');
        }
        return this;
    },

    renderOne: function(label, labelIndex) {
        const group = new LandmarkGroupView({model: label, labelIndex});
        // reset the view's element to it's template
        this.$el.append(group.render().$el);
        this.groups.push(group);
        return this;
    },

    cleanup: function () {
        this.groups.forEach(function (group) {
            group.cleanup();
            group.remove();
        });
        this.groups = [];
    }

});

export const ActionsView = Backbone.View.extend({

    el: '#lmActionsPanel',

    initialize: function({app}) {
        _.bindAll(this, 'save', 'help', 'render');
        this.listenTo(this.model.tracker, "change", this.render);
        this.app = app;
        this.render();
    },

    events: {
        'click #save': "save",
        'click #help': "help",
        'click #download': "download"
    },

    render: function () {
        this.$el.find('#save')
            .toggleClass('Active', !this.model.tracker.isUpToDate());
    },

    save: function (evt) {


        let gender = this.app.getGender();
        let typeOfPhoto = this.app.getTypeOfPhoto();
        const age = this.app.getAge();
        const wearBiceps = this.app.getWearBiceps();
        const wearChest = this.app.getWearChest();
        const wearUnderChest = this.app.getWearUnderChest();
        const wearWaist = this.app.getWearWaist();
        const wearHips = this.app.getWearHips();
        const wearLowHips = this.app.getWearLowHips();
        const wearThigh = this.app.getWearThigh();
        const wearKnee = this.app.getWearKnee();
        const wearCalf = this.app.getWearCalf();
        const wearAnkle = this.app.getWearAnkle();
        const lmg = this.app.getLandmarks();

        const points = lmg.landmarks.length;

        const firstConditionPart = gender && (typeOfPhoto || typeOfPhoto == "");
        let secondConditionPart = true;

        if(points === 93 || points === 68) {
            secondConditionPart = age && wearBiceps && wearChest && wearUnderChest && wearWaist
                && wearHips && wearLowHips && wearThigh && wearKnee && wearCalf && wearAnkle;
        }

        if (firstConditionPart && secondConditionPart) {
            evt.stopPropagation();
            $("#assetPager").find("#next").prop("disabled", false);

            $("#genderPanel").find("#errorRadio").removeClass('error-msg-show')
            this.$el.find('#save').addClass('Button--Disabled');
            this.model.save(gender, typeOfPhoto, age, {
                biceps: wearBiceps,
                chest: wearChest,
                under_chest: wearUnderChest,
                waist: wearWaist,
                hips: wearHips,
                low_hips: wearLowHips,
                thigh: wearThigh,
                knee: wearKnee,
                calf: wearCalf,
                ankle: wearAnkle,
            }).then(() => {
                this.$el.find('#save').removeClass('Button--Disabled');
            }, () => {
                this.$el.find('#save').removeClass('Button--Disabled');
            });
        } else {
            $("#genderPanel").find("#errorRadio").addClass('error-msg-show')
        }
    },

    help: function (e) {
        e.stopPropagation();  // prevent the event from trigging the help immediately
        this.app.toggleHelpOverlay();
    },

    download: function (evt) {
        evt.stopPropagation();
        if (this.model) {
            this.$el.find('#download').addClass('Button--Disabled');
            const data = JSON.stringify(this.model.toJSON());
            const filename = `${this.app.asset().id}_${this.app.activeTemplate()}.ljson`;
            download(data, filename, 'json');
            this.$el.find('#download').removeClass('Button--Disabled');

        }
    }
});

export const UndoRedoView = Backbone.View.extend({

    el: "#undoRedo",

    events: {
        'click .Undo': 'undo',
        'click .Redo': 'redo'
    },

    initialize: function ({app}) {
        this.tracker = this.model.tracker;
        this.app = app;
        this.listenTo(this.tracker, "change", this.render);
        _.bindAll(this, 'render', 'cleanup', 'undo', 'redo');
        this.render();
    },

    cleanup: function () {
        this.stopListening(this.tracker);
        this.$el.find('.Undo').addClass('Disabled');
        this.$el.find('.Redo').addClass('Disabled');
    },

    render: function () {
        this.$el.find('.Undo').toggleClass('Disabled', !this.tracker.canUndo());
        this.$el.find('.Redo').toggleClass('Disabled', !this.tracker.canRedo());
    },

    undo: function () {
        if (!this.tracker.canUndo()) {
            return;
        } else {
            this.model.undo();
        }
    },

    redo: function () {
        if (!this.tracker.canRedo()) {
            return;
        } else {
            this.model.redo();
        }
    }
});

export const LmLoadView = Backbone.View.extend({
    el: '#lmLoadPanel',

    events: {
        'click #loadPrevious': 'loadPrevious'
    },

    initialize: function ({app}) {
        _.bindAll(this, 'render', 'loadPrevious');
        this.app = app;
        this.render();
    },

    render: function () {
        const show = this.app.assetSource().hasPredecessor();
        this.$el.toggleClass('Hide', !show);
        this.$el.find('button').toggleClass('Button-Danger',
            !this.model.isEmpty());
    },

    loadPrevious: function () {
        this.app.reloadLandmarksFromPrevious();
        this.render();
    }
});
export const GenderToggle = Backbone.View.extend({

    el: '#genderRows',

    events: {
        'click #male': "clickedMale",
        'click #female': "clickedFemale"

    },

    initialize: function ({app}) {
        this.listenTo(this.model, "change", this.render);

        this.app = app;
        _.bindAll(this, 'render', 'clickedMale', 'clickedFemale');
        this.render();
    },


    render: function () {
        let gender = this.model.getGender();
        if (gender == ".m") {
            $("#male").prop("checked", true)
        } else if (gender == ".f") {
            $("#female").prop("checked", true)
        } else {
            $("#male").prop("checked", false)
            $("#female").prop("checked", false)
        }
    },

    clickedMale: function () {
        this.model.setGender(".m");
    },
    clickedFemale: function () {
        this.model.setGender(".f");
    }

});

export const TypeOfPhotoToggle = Backbone.View.extend({

    el: '#typeOfPhotoRows',

    events: {
        'click #usual': "clickedUsual",
        'click #selfie': "clickedSelfie"

    },
    initialize: function ({app}) {
        this.listenTo(this.model, "change", this.render);
        this.app = app;
        _.bindAll(this, 'render', 'clickedUsual', 'clickedSelfie');
        this.render();
    },

    render: function () {
        let typeOfPhoto = this.model.getTypeOfPhoto();
        let gender = this.model.getGender();

        if (typeOfPhoto == ".s") {
            $("#selfie").prop("checked", true)
        } else if (typeOfPhoto == "") {
            $("#usual").prop("checked", true)
        }  else {
            $("#selfie").prop("checked", false)
            $("#usual").prop("checked", false)
        }

        if ((typeOfPhoto || gender) == undefined ) {
            $("#assetPager").find("#next").prop("disabled", true);
        } else {
            $("#assetPager").find("#next").prop("disabled", false);
        }
    },

    clickedUsual: function () {
        this.model.setTypeOfPhoto("");

    },
    clickedSelfie: function () {
        this.model.setTypeOfPhoto(".s");
    }

});

export const AgeSelect = Backbone.View.extend({

    el: '#ageRow',

    events: {
        'change #age': "ageChange",
    },
    initialize: function ({app}) {
        this.listenTo(this.model, "change", this.render);
        this.app = app;
        _.bindAll(this, 'render', 'ageChange');
        this.render();
    },

    render: function () {
        let age = this.model.getAge();
        this.$el.find('#age').val(age);
    },

    ageChange: function (event) {
        const val = this.$el.find('#age').val();
        this.model.setAge(val);
    },

});

export const WearChestSelect = Backbone.View.extend({

    el: '#wearChestRow',

    events: {
        'change #wearChest': "valueChange",
    },
    initialize: function ({app}) {
        this.listenTo(this.model, "change", this.render);
        this.app = app;
        _.bindAll(this, 'render', 'valueChange');
        this.render();
    },

    render: function () {
        const val = this.model.getWearChest();
        this.$el.find('#wearChest').val(val).change();
    },

    valueChange: function (event) {
        const val = this.$el.find('#wearChest').val();
        this.model.setWearChest(val);
    },

});

export const WearBicepsSelect = Backbone.View.extend({

    el: '#wearBicepsRow',

    events: {
        'change #wearBiceps': "valueChange",
    },
    initialize: function ({app}) {
        this.listenTo(this.model, "change", this.render);
        this.app = app;
        _.bindAll(this, 'render', 'valueChange');
        this.render();
    },

    render: function () {
        const val = this.model.getWearBiceps();
        this.$el.find('#wearBiceps').val(val).change();
    },

    valueChange: function (event) {
        const val = this.$el.find('#wearBiceps').val();
        this.model.setWearBiceps(val);
    },

});

export const WearUnderChestSelect = Backbone.View.extend({

    el: '#wearUnderChestRow',

    events: {
        'change #wearUnderChest': "valueChange",
    },
    initialize: function ({app}) {
        this.listenTo(this.model, "change", this.render);
        this.app = app;
        _.bindAll(this, 'render', 'valueChange');
        this.render();
    },

    render: function () {
        const val = this.model.getWearUnderChest();
        this.$el.find('#wearUnderChest').val(val).change();
    },

    valueChange: function (event) {
        const val = this.$el.find('#wearUnderChest').val();
        this.model.setWearUnderChest(val);
    },

});

export const WearWaistSelect = Backbone.View.extend({

    el: '#wearWaistRow',

    events: {
        'change #wearWaist': "valueChange",
    },
    initialize: function ({app}) {
        this.listenTo(this.model, "change", this.render);
        this.app = app;
        _.bindAll(this, 'render', 'valueChange');
        this.render();
    },

    render: function () {
        const val = this.model.getWearWaist();
        this.$el.find('#wearWaist').val(val).change();
    },

    valueChange: function (event) {
        const val = this.$el.find('#wearWaist').val();
        this.model.setWearWaist(val);
    },

});

export const WearHipsSelect = Backbone.View.extend({

    el: '#wearHipsRow',

    events: {
        'change #wearHips': "valueChange",
    },
    initialize: function ({app}) {
        this.listenTo(this.model, "change", this.render);
        this.app = app;
        _.bindAll(this, 'render', 'valueChange');
        this.render();
    },

    render: function () {
        const val = this.model.getWearHips();
        this.$el.find('#wearHips').val(val).change();
    },

    valueChange: function (event) {
        const val = this.$el.find('#wearHips').val();
        this.model.setWearHips(val);
    },

});

export const WearLowHipsSelect = Backbone.View.extend({

    el: '#wearLowHipsRow',

    events: {
        'change #wearLowHips': "valueChange",
    },
    initialize: function ({app}) {
        this.listenTo(this.model, "change", this.render);
        this.app = app;
        _.bindAll(this, 'render', 'valueChange');
        this.render();
    },

    render: function () {
        const val = this.model.getWearLowHips();
        this.$el.find('#wearLowHips').val(val).change();
    },

    valueChange: function (event) {
        const val = this.$el.find('#wearLowHips').val();
        this.model.setWearLowHips(val);
    },

});

export const WearThighSelect = Backbone.View.extend({

    el: '#wearThighRow',

    events: {
        'change #wearThigh': "valueChange",
    },
    initialize: function ({app}) {
        this.listenTo(this.model, "change", this.render);
        this.app = app;
        _.bindAll(this, 'render', 'valueChange');
        this.render();
    },

    render: function () {
        const val = this.model.getWearThigh();
        this.$el.find('#wearThigh').val(val).change();
    },

    valueChange: function (event) {
        const val = this.$el.find('#wearThigh').val();
        this.model.setWearThigh(val);
    },

});

export const WearKneeSelect = Backbone.View.extend({

    el: '#wearKneeRow',

    events: {
        'change #wearKnee': "valueChange",
    },
    initialize: function ({app}) {
        this.listenTo(this.model, "change", this.render);
        this.app = app;
        _.bindAll(this, 'render', 'valueChange');
        this.render();
    },

    render: function () {
        const val = this.model.getWearKnee();
        this.$el.find('#wearKnee').val(val).change();
    },

    valueChange: function (event) {
        const val = this.$el.find('#wearKnee').val();
        this.model.setWearKnee(val);
    },

});

export const WearCalfSelect = Backbone.View.extend({

    el: '#wearCalfRow',

    events: {
        'change #wearCalf': "valueChange",
    },
    initialize: function ({app}) {
        this.listenTo(this.model, "change", this.render);
        this.app = app;
        _.bindAll(this, 'render', 'valueChange');
        this.render();
    },

    render: function () {
        const val = this.model.getWearCalf();
        this.$el.find('#wearCalf').val(val).change();
    },

    valueChange: function (event) {
        const val = this.$el.find('#wearCalf').val();
        this.model.setWearCalf(val);
    },

});

export const WearAnkleSelect = Backbone.View.extend({

    el: '#wearAnkleRow',

    events: {
        'change #wearAnkle': "valueChange",
    },
    initialize: function ({app}) {
        this.listenTo(this.model, "change", this.render);
        this.app = app;
        _.bindAll(this, 'render', 'valueChange');
        this.render();
    },

    render: function () {
        const val = this.model.getWearAnkle();
        this.$el.find('#wearAnkle').val(val).change();
    },

    valueChange: function (event) {
        const val = this.$el.find('#wearAnkle').val();
        this.model.setWearAnkle(val);
    },

});

function showNewElements() {
    $('#ageRow').show();
    $('#wearBicepsRow').show();
    $('#wearChestRow').show();
    $('#wearUnderChestRow').show();
    $('#wearWaistRow').show();
    $('#wearHipsRow').show();
    $('#wearLowHipsRow').show();
    $('#wearThighRow').show();
    $('#wearKneeRow').show();
    $('#wearCalfRow').show();
    $('#wearAnkleRow').show();
}

function hideNewElements() {
    $('#ageRow').hide();
    $('#wearBicepsRow').hide();
    $('#wearChestRow').hide();
    $('#wearUnderChestRow').hide();
    $('#wearWaistRow').hide();
    $('#wearHipsRow').hide();
    $('#wearLowHipsRow').hide();
    $('#wearThighRow').hide();
    $('#wearKneeRow').hide();
    $('#wearCalfRow').hide();
    $('#wearAnkleRow').hide();
}

export default Backbone.View.extend({

    initialize: function () {
        _.bindAll(this, "landmarksChange");
        this.listenTo(this.model, "change:landmarks", this.landmarksChange);
        this.actionsView = null;
        this.lmLoadView = null;
        this.lmView = null;
        this.undoRedoView = null;
        this.templatePanel = new TemplatePanel({model: this.model});
    },

    landmarksChange: function () {
        console.log('Sidebar - rewiring after landmark change');
        if (this.actionsView) {
            this.actionsView.undelegateEvents();
        }

        if (this.lmLoadView) {
            this.lmLoadView.undelegateEvents();
        }

        if (this.undoRedoView) {
            this.undoRedoView.undelegateEvents();
        }

        if (this.lmView) {
            this.lmView.cleanup();
        }

        const lms = this.model.landmarks();

        if (lms === null) {
            return;
        }

        this.actionsView = new ActionsView({model: lms, app: this.model});
        this.lmLoadView = new LmLoadView({model: lms, app: this.model});
        this.undoRedoView = new UndoRedoView({model: lms});
        this.lmView = new LandmarkGroupListView({collection: lms.labels});
        this.genderToggle = new GenderToggle({model: this.model});
        this.typeOfPhotoToggle = new TypeOfPhotoToggle({model: this.model});
        this.ageSelect = new AgeSelect({model: this.model});
        this.wearChestSelect = new WearChestSelect({model: this.model});
        this.wearBicepsSelect = new WearBicepsSelect({model: this.model});
        this.wearUnderChestSelect = new WearUnderChestSelect({model: this.model});
        this.wearWaistSelect = new WearWaistSelect({model: this.model});
        this.wearHipsSelect = new WearHipsSelect({model: this.model});
        this.wearLowHipsSelect = new WearLowHipsSelect({model: this.model});
        this.wearThighSelect = new WearThighSelect({model: this.model});
        this.wearKneeSelect = new WearKneeSelect({model: this.model});
        this.wearCalfSelect = new WearCalfSelect({model: this.model});
        this.wearAnkleSelect = new WearAnkleSelect({model: this.model});
        $('#landmarksPanel').html(this.lmView.render().$el);
    }
});

