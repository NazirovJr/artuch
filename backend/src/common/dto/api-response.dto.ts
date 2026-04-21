export class ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;

  static ok<T>(data: T, message?: string): ApiResponse<T> {
    const res = new ApiResponse<T>();
    res.success = true;
    res.data = data;
    res.message = message;
    return res;
  }

  static fail(message: string): ApiResponse<null> {
    const res = new ApiResponse<null>();
    res.success = false;
    res.data = null;
    res.message = message;
    return res;
  }
}
