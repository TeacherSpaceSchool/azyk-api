const mongoose = require('mongoose');

const OrderAzykSchema = mongoose.Schema({
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ItemAzyk'
   },
    count: Number,
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClientAzyk'
   },
    returned: {
        type: Number,
        default: 0
   },
    allPrice: Number,
    allTonnage: {
        type: Number,
        default: 0
   },
    status: String,
    agent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmploymentAzyk'
   },
    setRoute: {
        type: Boolean,
        default: false
   },
    ads: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AdsAzyk'
   },
}, {
    timestamps: true
});


const OrderAzyk = mongoose.model('OrderAzyk', OrderAzykSchema);

module.exports = OrderAzyk;