// ============================================================================
// ContentController
// ============================================================================

import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { ContentService } from './content.service';
import { CreateContentDto, UpdateContentDto, ChangeContentStatusDto } from './dto/content.dto';
import { Public, CurrentUser, AuthUser, ClientIp, Roles } from '../common/decorators';

@ApiTags('Contenido educativo')
@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  // --------------------------------------------------------------------------
  // PÚBLICO
  // --------------------------------------------------------------------------
  @Public()
  @Get()
  @ApiOperation({ summary: 'Listar artículos publicados' })
  list(
    @Query('category') category?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('perPage', new DefaultValuePipe(12), ParseIntPipe) perPage = 12,
  ) {
    return this.contentService.listPublished(category, page, Math.min(perPage, 50));
  }

  @Public()
  @Get('by-slug/:slug')
  @ApiOperation({ summary: 'Obtener artículo por slug' })
  getBySlug(@Param('slug') slug: string) {
    return this.contentService.getBySlug(slug);
  }

  // --------------------------------------------------------------------------
  // ESPECIALISTA
  // --------------------------------------------------------------------------
  @Roles(UserRole.SPECIALIST, UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Crear nuevo artículo (DRAFT)' })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateContentDto,
    @ClientIp() ip: string,
  ) {
    return this.contentService.create(user.sub, dto, ip);
  }

  @Roles(UserRole.SPECIALIST, UserRole.ADMIN)
  @Get('mine')
  @ApiOperation({ summary: 'Listar mis artículos' })
  listMine(@CurrentUser() user: AuthUser) {
    return this.contentService.listMyContent(user.sub);
  }

  @Roles(UserRole.SPECIALIST, UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar artículo' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateContentDto,
  ) {
    return this.contentService.update(user.sub, user.role, id, dto);
  }

  @Roles(UserRole.SPECIALIST)
  @Post(':id/submit')
  @ApiOperation({ summary: 'Enviar a revisión del admin' })
  submitForReview(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.contentService.submitForReview(user.sub, id);
  }

  // --------------------------------------------------------------------------
  // ADMIN
  // --------------------------------------------------------------------------
  @Roles(UserRole.ADMIN)
  @Get('admin/pending')
  @ApiOperation({ summary: 'Listar artículos pendientes de revisión' })
  listPendingReview() {
    return this.contentService.listPendingReview();
  }

  @Roles(UserRole.ADMIN)
  @Patch('admin/:id/status')
  @ApiOperation({ summary: 'Cambiar status (publicar/rechazar/archivar)' })
  changeStatus(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
    @Body() dto: ChangeContentStatusDto,
    @ClientIp() ip: string,
  ) {
    return this.contentService.changeStatus(admin.sub, id, dto, ip);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete (archivar)' })
  delete(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
    @ClientIp() ip: string,
  ) {
    return this.contentService.softDelete(admin.sub, id, ip);
  }
}
