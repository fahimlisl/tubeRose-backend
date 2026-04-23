import {v2 as cloudinary} from "cloudinary";
import { ApiError } from "./ApiError";


cloudinary.config({
    cloud_name:process.env.CLOUDINARY_CLOUD_NAME,
    api_key:process.env.CLOUDINARY_API_KEY,
    api_secret:process.env.CLOUDINARY_API_SECRET
});


type CloudinaryUploadResponse = {
  url: string;
  public_id: string;
}; 


const uploadOnCloudinary = async (
  fileBuffer: Buffer
): Promise<CloudinaryUploadResponse> => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: "tuberose" }, (error, result) => {
        if (error) return reject(error);

        resolve({
          url: result!.secure_url,
          public_id: result!.public_id,
        });
      })
      .end(fileBuffer);
  });
};

const deleteFromCloudinary = async(filePath:string) => {
    try {
        if (!filePath) {
            throw new ApiError(400,"file wasn't able to found")
        }
        const deleteFCloud = await cloudinary.uploader.destroy(filePath,{
            resource_type:"image"
        })
        if (!deleteFCloud) {
            throw new ApiError(500,"wasn't abel to delete that particular file form cloud")
        }
        return deleteFCloud
    } catch (error:any) {
        throw new ApiError(500,error.message || `got error while deleting file from cloudinary`)
    }
}

export {uploadOnCloudinary,deleteFromCloudinary}