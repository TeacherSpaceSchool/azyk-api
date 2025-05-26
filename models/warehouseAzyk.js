const mongoose = require('mongoose');

const WarehouseAzykSchema = mongoose.Schema({
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrganizationAzyk'
    },
    name: String,
    guid: String,
}, {
    timestamps: true
});

const WarehouseAzyk = mongoose.model('WarehouseAzyk', WarehouseAzykSchema);

module.exports = WarehouseAzyk;