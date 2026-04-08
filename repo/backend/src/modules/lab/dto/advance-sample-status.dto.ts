import { IsEnum } from 'class-validator';
import { SampleStatus } from '../lab-sample.entity';

export class AdvanceSampleStatusDto {
  @IsEnum(SampleStatus)
  status: SampleStatus;
}
