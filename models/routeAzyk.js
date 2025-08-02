const mongoose = require('mongoose');

const RouteAzykSchema = mongoose.Schema({
    deliverys: [{
        legs:[[String]],
        orders: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'InvoiceAzyk'
       }],
        tonnage: {
            type: Number,
            default: 0
       },
        lengthInMeters: {
            type: Number,
            default: 0
       }
   }],
    provider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrganizationAzyk'
   },
    selectProdusers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrganizationAzyk'
   }],
    selectDistricts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DistrictAzyk'
   }],
    selectEcspeditor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmploymentAzyk'
   },
    selectAuto: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AutoAzyk'
   },
    selectedOrders: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InvoiceAzyk'
   }],
    dateDelivery: Date,
    status: String,
    number: String,
    allTonnage: {
        type: Number,
        default: 0
   }
}, {
    timestamps: true
});


const RouteAzyk = mongoose.model('RouteAzyk', RouteAzykSchema);

module.exports = RouteAzyk;