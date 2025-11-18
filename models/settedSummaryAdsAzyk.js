const mongoose = require('mongoose');

const SettedSummaryAdsAzykSchema = mongoose.Schema({
    dateDelivery: Date,
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrganizationAzyk'
    },
    forwarder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmploymentAzyk'
    },
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ItemAzyk'
    },
    count: Number
}, {
    timestamps: true
});

const SettedSettedSummaryAdsAzyk = mongoose.model('SettedSummaryAdsAzyk', SettedSummaryAdsAzykSchema);

module.exports = SettedSettedSummaryAdsAzyk;