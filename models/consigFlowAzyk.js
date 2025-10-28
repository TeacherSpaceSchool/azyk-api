const mongoose = require('mongoose');

const ConsigFlowAzykSchema = mongoose.Schema({
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrganizationAzyk'
   },
    invoice: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InvoiceAzyk'
    },
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClientAzyk'
    },
    amount: Number,
    cancel: Boolean,
    sign: Number
}, {
    timestamps: true
});

const ConsigFlowAzyk = mongoose.model('ConsigFlowAzyk', ConsigFlowAzykSchema);

module.exports = ConsigFlowAzyk;