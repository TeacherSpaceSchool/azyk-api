const mongoose = require('mongoose');

const DeliveryDateAzykSchema = mongoose.Schema({
    days: {
        type: [Boolean],
        default: [true, true, true, true, true, true, true]
   },
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClientAzyk'
   },
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrganizationAzyk'
   }
}, {
    timestamps: true
});


const DeliveryDateAzyk = mongoose.model('DeliveryDateAzyk', DeliveryDateAzykSchema);

module.exports = DeliveryDateAzyk;