const validateRequest = (schema) => async (req, res, next) => {
    try {
        await schema.parseAsync({
            body: req.body,
            query: req.query,
            params: req.params
        });
        next();
    } catch (error) {
        return res.status(400).json({ status: 400, message: "Validation error", errors: error.errors });
    }
};

module.exports = validateRequest;
