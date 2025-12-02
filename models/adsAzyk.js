const mongoose = require('mongoose');

const AdsAzykSchema = mongoose.Schema({
    image: String,
    url: String,
    xid: {
        type: String,
        default: ''
   },
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrganizationAzyk'
   },
    del: String,
    paymentMethods: [String],
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ItemAzyk'
   },
    count: {
        type: Number,
        default: 0
   },
    title: String,
    targetPrice: {
        type: Number,
        default: 0
   }
}, {
    timestamps: true
});

const AdsAzyk = mongoose.model('AdsAzyk', AdsAzykSchema);

module.exports = AdsAzyk;