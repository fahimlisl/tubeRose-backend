class ApiError extends Error{
    success:boolean;
    data:any;
    status:number;
    errors:any[];

    constructor(
        status:number,
        message = "something went wrong",
        stack?: string,
        errors = [],
    ){
        super(message)
        this.stack = stack
        this.data = null
        this.status = status
        this.success = false
        this.errors = errors
        if (stack) {
            this.stack = stack
        }else{
            Error.captureStackTrace(this,this.constructor)
        }
    }
}

export {ApiError}