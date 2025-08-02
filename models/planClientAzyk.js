const mongoose = require('mongoose');

const PlanClientAzykSchema = mongoose.Schema({
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrganizationAzyk'
   },
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClientAzyk'
   },
    month: {
        type: Number,
        default: 0
   },
    visit: {
        type: Number,
        default: 0
   }
}, {
    timestamps: true
});

const PlanClientAzyk = mongoose.model('PlanClientAzyk', PlanClientAzykSchema);

module.exports = PlanClientAzyk;