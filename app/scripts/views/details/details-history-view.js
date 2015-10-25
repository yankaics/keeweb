'use strict';

var Backbone = require('backbone'),
    KeyHandler = require('../../comp/key-handler'),
    Keys = require('../../const/keys'),
    Format = require('../../util/format'),
    Alerts = require('../../comp/alerts'),
    FieldViewReadOnly = require('../fields/field-view-read-only'),
    FieldViewReadOnlyRaw = require('../fields/field-view-read-only-raw');

var DetailsHistoryView = Backbone.View.extend({
    template: require('templates/details/details-history.html'),

    events: {
        'click .details__history-close': 'closeHistory',
        'click .details__history-timeline-item': 'timelineItemClick',
        'click .details__history-arrow-prev': 'timelinePrevClick',
        'click .details__history-arrow-next': 'timelineNextClick',
        'click .details__history-button-revert': 'revertClick',
        'click .details__history-button-delete': 'deleteClick',
        'click .details__history-button-discard': 'discardClick'
    },

    formats: [
        { name: 'ms', round: 1, format: function(d) { return Format.dtStr(d); } },
        { name: 'sec', round: 1000, format: function(d) { return Format.dtStr(d); } },
        { name: 'min', round: 1000*60, format: function(d) { return Format.dtStr(d).replace(':00 ', ' '); } },
        { name: 'hour', round: 1000*60*60, format: function(d) { return Format.dtStr(d).replace(':00', ''); } },
        { name: 'day', round: 1000*60*60*24, format: function(d) { return Format.dStr(d); } },
        { name: 'month', round: 1000*60*60*24*31, format: function(d) { return Format.dStr(d); } },
        { name: 'year', round: 1000*60*60*24*365, format: function(d) { return d.getFullYear(); } }
    ],

    fieldViews: null,

    initialize: function() {
        this.fieldViews = [];
    },

    render: function(visibleRecord) {
        this.renderTemplate(null, true);
        KeyHandler.onKey(Keys.DOM_VK_ESCAPE, this.closeHistory, this);
        this.history = this.model.getHistory();
        this.buildTimeline();
        this.timelineEl = this.$el.find('.details__history-timeline');
        this.bodyEl = this.$el.find('.details__history-body');
        this.timeline.forEach(function(item, ix) {
            $('<i/>').addClass('fa fa-circle details__history-timeline-item')
                .css('left', (item.pos * 100) + '%')
                .attr('data-id', ix)
                .appendTo(this.timelineEl);
        }, this);
        this.labels.forEach(function(label) {
            $('<div/>').addClass('details__history-timeline-label')
                .css('left', (label.pos * 100) + '%')
                .text(label.text)
                .appendTo(this.timelineEl);
        }, this);
        if (visibleRecord === undefined) {
            visibleRecord = this.history.length - 1;
        }
        this.showRecord(visibleRecord);
        return this;
    },

    remove: function() {
        this.removeFieldViews();
        KeyHandler.offKey(Keys.DOM_VK_ESCAPE, this.closeHistory, this);
        Backbone.View.prototype.remove.call(this);
    },

    removeFieldViews: function() {
        this.fieldViews.forEach(function(fieldView) { fieldView.remove(); });
        this.fieldViews = [];
    },

    showRecord: function(ix) {
        this.activeIx = ix;
        this.record = this.timeline[ix].rec;
        this.timelineEl.find('.details__history-timeline-item').removeClass('details__history-timeline-item--active');
        this.timelineEl.find('.details__history-timeline-item[data-id="' + ix + '"]').addClass('details__history-timeline-item--active');
        this.removeFieldViews();
        this.bodyEl.html('');
        var colorCls = this.record.color ? this.record.color + '-color' : '';
        this.fieldViews.push(new FieldViewReadOnly({ model: { name: 'Rev', title: 'Version', value: ix + 1 } }));
        this.fieldViews.push(new FieldViewReadOnly({ model: { name: 'Updated', title: 'Saved',
            value: Format.dtStr(this.record.updated) +
            (this.record.unsaved ? ' (current unsaved state)' : '') +
            ((ix === this.history.length - 1 && !this.record.unsaved) ? ' (current state)' : '') } }));
        this.fieldViews.push(new FieldViewReadOnlyRaw({ model: { name: '$Title', title: 'Title',
            value: '<i class="fa fa-' + this.record.icon + ' ' + colorCls + '"></i> ' + _.escape(this.record.title) || '(no title)' } }));
        this.fieldViews.push(new FieldViewReadOnly({ model: { name: '$UserName', title: 'User', value: this.record.user } }));
        this.fieldViews.push(new FieldViewReadOnly({ model: { name: '$Password', title: 'Password', value: this.record.password } }));
        this.fieldViews.push(new FieldViewReadOnly({ model: { name: '$URL', title: 'Website', value: this.record.url } }));
        this.fieldViews.push(new FieldViewReadOnly({ model: { name: '$Notes', title: 'Notes', value: this.record.notes } }));
        this.fieldViews.push(new FieldViewReadOnly({ model: { name: 'Tags', title: 'Tags', value: this.record.tags.join(', ') } }));
        this.fieldViews.push(new FieldViewReadOnly({ model: { name: 'Expires', title: 'Expires',
            value: this.record.expires ? Format.dtStr(this.record.expires) : 'Never' } }));
        _.forEach(this.record.fields, function(value, field) {
            this.fieldViews.push(new FieldViewReadOnly({ model: { name: '$' + field, title: field, value: value } }));
        }, this);
        if (this.record.attachments.length) {
            this.fieldViews.push(new FieldViewReadOnly({ model: { name: 'Attachments', title: 'Attachments',
                value: this.record.attachments.map(function(att) { return att.title; }).join(', ') } }));
        }
        this.fieldViews.forEach(function(fieldView) {
            fieldView.setElement(this.bodyEl).render();
        }, this);
        var buttons = this.$el.find('.details__history-buttons');
        buttons.find('.details__history-button-revert').toggle(ix < this.history.length - 1);
        buttons.find('.details__history-button-delete').toggle(ix < this.history.length - 1);
        buttons.find('.details__history-button-discard').toggle(this.record.unsaved && ix === this.history.length - 1 &&
            this.history.length > 1 || false);
    },

    timelineItemClick: function(e) {
        var id = $(e.target).closest('.details__history-timeline-item').data('id');
        this.showRecord(id);
    },

    timelinePrevClick: function() {
        if (this.activeIx > 0) {
            this.showRecord(this.activeIx - 1);
        }
    },

    timelineNextClick: function() {
        if (this.activeIx < this.timeline.length - 1) {
            this.showRecord(this.activeIx + 1);
        }
    },

    buildTimeline: function() {
        var firstRec = this.history[0],
            lastRec = this.history[this.history.length - 1];
        this.timeline = this.history.map(function(rec) {
            return {
                pos: (rec.updated - firstRec.updated) / (lastRec.updated - firstRec.updated),
                rec: rec
            };
        }, this);
        var period = lastRec.updated - firstRec.updated;
        var format = this.getDateFormat(period);
        this.labels = this.getLabels(firstRec.updated.getTime(), lastRec.updated.getTime(), format.round)
            .map(function(label) {
                return {
                    pos: (label - firstRec.updated) / (lastRec.updated - firstRec.updated),
                    val: label,
                    text: format.format(new Date(label))
                };
            });
    },

    getDateFormat: function(period) {
        for (var i = 0; i < this.formats.length; i++) {
            if (period < this.formats[i].round * 1.2) {
                return this.formats[i > 0 ? i - 1 : 0];
            }
        }
        return this.formats[this.formats.length - 1];
    },

    getLabels: function(first, last, round) {
        var count = Math.floor((last - first) / round);
        if (count > 2) {
            round *= Math.ceil(count / 2);
        }
        var labels = [];
        var label = Math.ceil(first / round) * round;
        while (label < last) {
            labels.push(label);
            label += round;
        }
        if (labels.length > 1 && (labels[0] - first) / (last - first) < 0.10) {
            labels.shift();
        }
        return labels;
    },

    closeHistory: function(updated) {
        this.trigger('close', { updated: updated });
    },

    revertClick: function() {
        Alerts.yesno({
            header: 'Revert to this history state?',
            body: 'Your current state will be saved to history.',
            success: (function() {
                this.model.revertToHistoryState(this.record.entry);
                this.closeHistory(true);
            }).bind(this)
        });
    },

    deleteClick: function() {
        Alerts.yesno({
            header: 'Delete this history state?',
            body: 'You will not be able to restore it.',
            success: (function() {
                this.model.deleteHistory(this.record.entry);
                this.render(this.activeIx);
            }).bind(this)
        });
    },

    discardClick: function() {
        Alerts.yesno({
            header: 'Discard changed made to entry?',
            body: 'Unsaved changed will by lost, there will be no way back.',
            success: (function() {
                this.model.discardUnsaved();
                this.closeHistory(true);
            }).bind(this)
        });
    }
});

module.exports = DetailsHistoryView;
