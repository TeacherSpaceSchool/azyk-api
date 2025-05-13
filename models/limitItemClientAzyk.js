const mongoose = require('mongoose');

const LimitItemClientAzykSchema = mongoose.Schema({
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ItemAzyk'
    },
    limit: Number,
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ClientAzyk'
    },
    organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrganizationAzyk'
    },
}, {
    timestamps: true
});

LimitItemClientAzykSchema.index({client: 1})
LimitItemClientAzykSchema.index({organization: 1})

const LimitItemClientAzyk = mongoose.model('LimitItemClientAzyk', LimitItemClientAzykSchema);

module.exports = LimitItemClientAzyk;