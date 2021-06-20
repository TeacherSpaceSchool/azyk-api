const passport = require('passport');
const LocalStrategy = require('passport-local');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const jwtsecret = '@615141ViDiK141516@';
const UserAzyk = require('../models/userAzyk');
const ClientAzyk = require('../models/clientAzyk');
const EmploymentAzyk = require('../models/employmentAzyk');
//const { setProfile, getProfile } = require('../redis/profile');
const jwt = require('jsonwebtoken');

let start = () => {
//настройка паспорта
    passport.use(new LocalStrategy({
            usernameField: 'login',
            passwordField: 'password',
            session: false
        },
        function (login, password, done) {
            UserAzyk.findOne({login: login}, (err, user) => {
                if (err) {
                    return done(err);
                }

                if (!user || !user.checkPassword(password) || user.status!=='active') {
                    return done(null, false, {message: 'Нет такого пользователя или пароль неверен.'});
                }
                return done(null, user);
            });
        })
    );
    const jwtOptions = {};
    jwtOptions.jwtFromRequest= ExtractJwt.fromAuthHeaderAsBearerToken();
    jwtOptions.secretOrKey=jwtsecret;
    passport.use(new JwtStrategy(jwtOptions, function (payload, done) {
        UserAzyk.findOne({login:payload.login}, (err, user) => {
            if (err) {
                return done(err)
            }
            if (user) {
                return done(null, user)
            } else {
                return done(null, false)
            }}
        ).lean()
    }));
}

const verifydrole = async (req, res, func) => {
    await passport.authenticate('jwt', async function (err, user) {
        try{
            if (user&&user.status==='active') {
                await func(user.role)
            } else {
                console.error('No such user')
                res.status(401);
                res.end('No such user');
            }
        } catch (err) {
            console.error(err)
            res.status(401);
            res.end('err')
        }
    } )(req, res)
}

const verifydeuser = async (req, res, func) => {
    await passport.authenticate('jwt', async function (err, user) {
        try{
            if (user&&user.status==='active') {
                await func(user)
            } else {
                console.error('No such user')
                res.status(401);
                res.end('No such user');
            }
        } catch (err) {
            console.error(err)
            res.status(401);
            res.end('err')
        }
    } )(req, res)
}

const getuser = async (req, res, func) => {
    await passport.authenticate('jwt', async function (err, user) {
        try{
            await func(user)

        } catch (err) {
            console.error(err)
            res.status(401);
            res.end('err')
        }
    } )(req, res)
}

const verifydeuserGQL = async (req, res) => {
    return new Promise((resolve) => { passport.authenticate('jwt', async function (err, user) {
        try{
            if (user&&user.status==='active') {
                if('admin'===user.role)
                    resolve(user)
                else if('client'===user.role) {
                    let client = await ClientAzyk.findOne({user: user._id}).select('client category city')
                    user.client = client._id
                    user.category = client.category
                    user.city = client.city
                    client.lastActive = new Date()
                    await client.save()
                    resolve(user)

                }
                else if(['суперагент', 'суперменеджер', 'суперэкспедитор'].includes(user.role)) {
                    let employment = await EmploymentAzyk.findOne({user: user._id}).select('_id').lean()
                    user.employment = employment._id
                    resolve(user)
                }
                else {
                    let employment = await EmploymentAzyk.findOne({user: user._id})
                        .select('_id organization')
                        .populate({ path: 'organization', select: 'onlyIntegrate onlyDistrict _id status addedClient cities' }).lean()
                    if(employment.organization.status==='active') {
                        user.organization = employment.organization._id
                        user.employment = employment._id
                        user.onlyIntegrate = employment.organization.onlyIntegrate
                        user.onlyDistrict = employment.organization.onlyDistrict
                        user.addedClient = employment.organization.addedClient
                        user.cities = employment.organization.cities
                        resolve(user)
                    }
                    else {
                        resolve({})
                    }
                }
            } else {
                resolve({})
            }
        } catch (err) {
            console.error(err)
            resolve({})
        }
    } )(req, res)
    })


}

const signinuser = (req, res) => {
    passport.authenticate('local', async function (err, user) {
        try{
            if (user&&user.status==='active') {
                const payload = {
                    id: user._id,
                    login: user.login,
                    status: user.status,
                    role: user.role
                };
                const token = await jwt.sign(payload, jwtsecret); //здесь создается JWT
                await res.status(200);
                await res.clearCookie('jwt');
                await res.cookie('jwt', token, {maxAge: 10000*24*60*60*1000}).end(token);
            } else {
                res.status(401);
                res.end('Login failed',401)
            }
        } catch (err) {
            console.error(err)
            res.status(401);
            res.end('login not be unique')
        }
    })(req, res);
}

const getstatus = async (req, res) => {
    await passport.authenticate('jwt', async function (err, user) {
        try{
            if (user&&user.status==='active') {
                res.status(200);
                res.end(JSON.stringify({status: user.status, role: user.role, id: user._id}))
            } else {
                console.error('No such user')
                res.status(401);
                res.end('No such user');
            }
        } catch (err) {
            console.error(err)
            res.status(401);
            res.end('err')
        }
    } )(req, res)

}

const signupuser = async (req, res) => {
    try{
        let _user = new UserAzyk({
            login: req.query.login,
            role: 'client',
            status: 'active',
            password: req.query.password,
        });
        const user = await UserAzyk.create(_user);
        const payload = {
            id: user._id,
            login: user.login,
            status: user.status,
            role: user.role
        };
        const token = jwt.sign(payload, jwtsecret); //здесь создается JWT*/
        await res.status(200);
        await res.clearCookie('jwt');
        await res.cookie('jwt', token, {maxAge: 10000*24*60*60*1000}).end(token)
    } catch (err) {
        console.error(err)
        res.status(401);
        res.end('login not be unique')
    }
}

const signupuserGQL = async ({password, login}, res) => {
    try{
        //await UserAzyk.deleteMany()
        let user = new UserAzyk({
            login: login.trim(),
            role: 'client',
            status: 'active',
            password: password,
        });
        user = await UserAzyk.create(user);
        const client = new ClientAzyk({
            name: '',
            email: '',
            address: [],
            info: '',
            reiting: 0,
            image: '/static/add.png',
            user: user._id,
            phone: [],
            city: '',
            notification: false
        });
        await ClientAzyk.create(client);
        const payload = {
            id: user._id,
            login: user.login,
            status: user.status,
            role: user.role
        };
        const token = jwt.sign(payload, jwtsecret); //здесь создается JWT*/
        await res.clearCookie('jwt');
        await res.cookie('jwt', token, {maxAge: 10000*24*60*60*1000 })
        return {
            role: user.role,
            status: user.status,
            login: user.login,
            organization: user.organization,
            _id: user._id
        }
    } catch (err) {
        console.error(err)
        return {role: 'Проверьте данные'}
    }
}

const signinuserGQL = (req, res) => {
    return new Promise((resolve) => {
        passport.authenticate('local', async function (err, user) {
            try{
                if (user&&user.status==='active') {
                    const payload = {
                        id: user._id,
                        login: user.login,
                        status: user.status,
                        role: user.role
                    };
                    const token = await jwt.sign(payload, jwtsecret); //здесь создается JWT
                    await res.clearCookie('jwt');
                    await res.cookie('jwt', token, {maxAge: 10000*24*60*60*1000 });
                    if(!['admin', 'client'].includes(user.role)) {
                        let employment = await EmploymentAzyk.findOne({user: user._id}).select('organization').lean()
                        user.organization = employment.organization
                    }
                    resolve({
                        role: user.role,
                        status: user.status,
                        login: user.login,
                        organization: user.organization,
                        _id: user._id
                    })
                } else {
                    resolve({role: 'Проверьте данные'})
                }
            } catch (err) {
                console.error(err)
                resolve({role: 'Проверьте данные'})
            }
        })(req, res);
    })
}

const createJwtGQL = async (res, user) => {
    const payload = {
        id: user._id,
        login: user.login,
        status: user.status,
        role: user.role
    };
    const token = await jwt.sign(payload, jwtsecret); //здесь создается JWT
    await res.clearCookie('jwt');
    await res.cookie('jwt', token, {maxAge: 10000*24*60*60*1000 });
}

module.exports.getuser = getuser;
module.exports.createJwtGQL = createJwtGQL;
module.exports.verifydrole = verifydrole;
module.exports.signupuserGQL = signupuserGQL;
module.exports.getstatus = getstatus;
module.exports.verifydeuserGQL = verifydeuserGQL;
module.exports.start = start;
module.exports.verifydeuser = verifydeuser;
module.exports.signinuser = signinuser;
module.exports.signinuserGQL = signinuserGQL;
module.exports.signupuser = signupuser;