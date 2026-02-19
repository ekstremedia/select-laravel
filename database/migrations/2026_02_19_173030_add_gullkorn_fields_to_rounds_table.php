<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('rounds', function (Blueprint $table) {
            $table->unsignedBigInteger('gullkorn_source_id')->nullable()->after('grace_count');
            $table->jsonb('used_gullkorn_ids')->nullable()->after('gullkorn_source_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('rounds', function (Blueprint $table) {
            $table->dropColumn(['gullkorn_source_id', 'used_gullkorn_ids']);
        });
    }
};
