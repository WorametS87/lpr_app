import {
  Controller,
  ParseFilePipeBuilder,
  Post,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InferService } from './infer.service';
import type { InferenceResponse } from '@lpr/shared-types';

@Controller('v1/infer')
export class InferController {
  constructor(private readonly inferService: InferService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  async inferImage(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpg|jpeg|png|webp)$/i
        })
        .addMaxSizeValidator({
          maxSize: 5 * 1024 * 1024
        })
        .build({
          errorHttpStatusCode: 422
        })
    )
    file: Express.Multer.File
  ): Promise<InferenceResponse> {
    return this.inferService.inferImage(file);
  }
}
