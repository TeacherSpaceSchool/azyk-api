const mongoose = require('mongoose');

const AdsAzykSchema = mongoose.Schema({
    image: String,
    url: String,
    xid: {
        type: String,
        default: ''
   },
    xidNumber: {
        type: Number,
        default: 0
   },
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrganizationAzyk'
   },
    del: String,
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ItemAzyk'
   },
    count: {
        type: Number,
        default: 0
   },
    title: String,
    targetItems: [{
        xids: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ItemAzyk',
            default: []
       }],
        count: {
            type: Number,
            default: 0
       },
        sum: {
            type: Boolean,
            default: false
       },
        type: {
            type: String,
            default: 'Количество'
       },
        targetPrice: {
            type: Number,
            default: 0
       },
   }],
    targetPrice: {
        type: Number,
        default: 0
   },
    multiplier: {
        type: Boolean,
        default: false
   },
    targetType: {
        type: String,
        default: 'Цена'
   },
}, {
    timestamps: true
});

const AdsAzyk = mongoose.model('AdsAzyk', AdsAzykSchema);

module.exports = AdsAzyk;