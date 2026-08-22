import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminCreateReviewDto, CreateReviewDto, ListReviewsQueryDto, UpdateReviewDto } from './dto/review.dto';
import { ReviewService } from './review.service';

@ApiTags('Reviews')
@Controller()
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post('products/:productId/reviews')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create product review' })
  create(@Request() req, @Param('productId') productId: string, @Body() dto: CreateReviewDto) {
    return this.reviewService.create(req.user.id, productId, dto);
  }

  @Get('products/:productId/reviews')
  @ApiOperation({ summary: 'Get approved product reviews' })
  productReviews(@Param('productId') productId: string) {
    return this.reviewService.productReviews(productId);
  }

  @Post('reviews')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create review (admin)' })
  createAdmin(@Request() req, @Body() dto: AdminCreateReviewDto) {
    return this.reviewService.createAdmin(req.user.id, dto);
  }

  @Get('reviews')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all reviews with pagination (admin)' })
  findAll(@Query() query: ListReviewsQueryDto) {
    return this.reviewService.findAll(query);
  }

  @Get('reviews/pending')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get pending reviews with pagination (admin)' })
  pending(@Query() query: ListReviewsQueryDto) {
    return this.reviewService.pending(query);
  }

  @Patch('reviews/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update review (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateReviewDto) {
    return this.reviewService.update(id, dto);
  }

  @Delete('reviews/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete review (admin)' })
  remove(@Param('id') id: string) {
    return this.reviewService.remove(id);
  }
}
