const mongoose = require('mongoose');

const ReturnedAzykSchema = mongoose.Schema({
    items: mongoose.Schema.Types.Mixed,
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClientAzyk'
    },
    dateDelivery: Date,
    allPrice: Number,
    allTonnage: {
        type: Number,
        default: 0
    },
    inv: {
        type: Number,
        default: 0
    },
    allSize: {
        type: Number,
        default: 0
    },
    number: String,
    info: String,
    address: [String],
    confirmationForwarder: {
        type: Boolean,
        default: null
    },
    cancelForwarder: {
        type: Boolean,
        default: null
    },
    sync: {
        type: Number,
        default: 0
    },
    del: String,
    editor: String,
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrganizationAzyk'
    },
    agent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmploymentAzyk'
    },
    district: String,
    guid: String,
    city: String,
    track: {
        type: Number,
        default: 1
    },
    forwarder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmploymentAzyk'
    },
}, {
    timestamps: true
});


const ReturnedAzyk = mongoose.model('ReturnedAzyk', ReturnedAzykSchema);

module.exports = ReturnedAzyk;