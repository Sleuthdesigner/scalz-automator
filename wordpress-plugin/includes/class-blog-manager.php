<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

class Scalz_Blog_Manager {
    private static function build_prompt( string $key, array $vars ): string {
        $tpl = get_option( 'scalz_seo_prompt_' . $key, '' );
        foreach ( $vars as $k => $v ) { $tpl = str_replace( '{' . $k . '}', $v, $tpl ); }
        return $tpl;
    }
    private static function ai( string $p ): string { return class_exists( 'Scalz_Integration_Manager' ) ? Scalz_Integration_Manager::generate( $p ) : ''; }

    public static function generate_post( array $params ): array {
        $client = $params['client'] ?? []; $title = sanitize_text_field( $params['title'] ?? '' ); $focus = sanitize_text_field( $params['focus_keyword'] ?? $title );
        if ( empty( $title ) ) return [ 'error' => 'Title is required' ];
        $content = self::ai( self::build_prompt( 'blog_content', [ 'title' => $title, 'focus_keyword' => $focus, 'niche' => $client['niche'] ?? '', 'city' => $client['city'] ?? '', 'state' => $client['state'] ?? '', 'business_name' => $client['business_name'] ?? '', 'phone' => $client['phone'] ?? '' ] ) );
        if ( ! $content ) return [ 'error' => 'AI generation failed' ];
        $faq_schema = '';
        if ( preg_match( '/\[\s*\{\s*"question"/i', $content ) ) {
            preg_match( '/\[.*\]/s', $content, $jm );
            if ( $jm ) { $faqs = json_decode( $jm[0], true ); if ( $faqs && is_array( $faqs ) ) { $faq_schema = Scalz_Schema_Manager::build_faq_schema( $faqs ); $content = preg_replace( '/\[.*\]/s', '', $content ); } }
        }
        $post_content = wpautop( wp_kses_post( $content ) ) . $faq_schema;
        $post_id = wp_insert_post( [ 'post_title' => $title, 'post_content' => $post_content, 'post_status' => 'draft', 'post_type' => 'post', 'post_author' => 1 ] );
        if ( is_wp_error( $post_id ) ) return [ 'error' => $post_id->get_error_message() ];
        update_post_meta( $post_id, 'rank_math_focus_keyword', $focus );
        return [ 'post_id' => $post_id, 'title' => $title, 'url' => get_permalink( $post_id ), 'status' => 'draft' ];
    }

    public static function batch_generate( array $params ): array {
        $client = $params['client'] ?? []; $titles = $params['titles'] ?? []; $count = intval( $params['count'] ?? count( $titles ) );
        if ( empty( $titles ) ) {
            $existing = array_map( 'get_the_title', get_posts( [ 'post_type' => 'post', 'posts_per_page' => 50, 'fields' => 'ids' ] ) );
            $raw = self::ai( self::build_prompt( 'blog_title', [ 'count' => $count, 'niche' => $client['niche'] ?? 'local business', 'city' => $client['city'] ?? '', 'state' => $client['state'] ?? '', 'business_name' => $client['business_name'] ?? '', 'existing_titles' => implode( "\n", $existing ) ] ) );
            $titles = array_slice( array_filter( array_map( 'trim', explode( "\n", $raw ) ) ), 0, $count );
        }
        $results = [];
        foreach ( $titles as $t ) { $results[] = self::generate_post( array_merge( $params, [ 'title' => $t ] ) ); sleep( 1 ); }
        return [ 'generated' => count( array_filter( $results, fn( $r ) => ! isset( $r['error'] ) ) ), 'errors' => count( array_filter( $results, fn( $r ) => isset( $r['error'] ) ) ), 'results' => $results ];
    }
}
