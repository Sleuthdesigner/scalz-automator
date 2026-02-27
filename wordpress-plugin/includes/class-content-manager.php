<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

class Scalz_Content_Manager {
    private static function get_pages(): array {
        return array_map( fn( $p ) => [ 'id' => $p->ID, 'url' => get_permalink( $p->ID ), 'title' => get_the_title( $p->ID ) ],
            get_posts( [ 'post_type' => 'page', 'post_status' => 'publish', 'posts_per_page' => -1 ] ) );
    }
    private static function build_prompt( string $key, array $vars ): string {
        $tpl = get_option( 'scalz_seo_prompt_' . $key, '' );
        foreach ( $vars as $k => $v ) { $tpl = str_replace( '{' . $k . '}', $v, $tpl ); }
        return $tpl;
    }
    private static function ai( string $p ): string { return class_exists( 'Scalz_Integration_Manager' ) ? Scalz_Integration_Manager::generate( $p ) : ''; }
    public static function get_acf_content(): array {
        if ( ! function_exists( 'get_field' ) ) return [ 'error' => 'ACF not active' ];
        $p = self::get_pages(); foreach ( $p as &$pg ) { $pg['acf_content'] = get_field( 'content', $pg['id'] ) ?: ''; } return $p;
    }
    public static function generate_acf_content( array $params ): array {
        if ( ! function_exists( 'update_field' ) ) return [ 'error' => 'ACF not active' ];
        $client = $params['client'] ?? []; $updated = $errors = 0; $results = [];
        foreach ( self::get_pages() as $page ) {
            $fk = get_post_meta( $page['id'], 'rank_math_focus_keyword', true ) ?: get_the_title( $page['id'] );
            $gen = self::ai( self::build_prompt( 'acf_content', [ 'title' => get_the_title( $page['id'] ), 'focus_keyword' => $fk, 'service' => $client['services'] ?? $client['niche'] ?? '', 'niche' => $client['niche'] ?? '', 'city' => $client['city'] ?? '', 'state' => $client['state'] ?? '', 'location' => trim( ( $client['city'] ?? '' ) . ', ' . ( $client['state'] ?? '' ) ), 'business_name' => $client['business_name'] ?? '', 'phone' => $client['phone'] ?? '', 'address' => $client['address'] ?? '' ] ) );
            if ( $gen ) { update_field( 'content', $gen, $page['id'] ); $updated++; $results[] = [ 'id' => $page['id'], 'status' => 'updated' ]; }
            else { $errors++; $results[] = [ 'id' => $page['id'], 'status' => 'error' ]; }
        }
        return [ 'updated' => $updated, 'errors' => $errors, 'results' => $results ];
    }
    public static function get_h2_headings(): array {
        $p = self::get_pages();
        foreach ( $p as &$pg ) { preg_match_all( '/<h2[^>]*>(.*?)<\/h2>/is', get_post_field( 'post_content', $pg['id'] ), $m ); $pg['h2_headings'] = $m[1] ?? []; }
        return $p;
    }
    public static function generate_h2_headings( array $params ): array {
        $client = $params['client'] ?? []; $updated = $errors = 0; $results = [];
        foreach ( self::get_pages() as $page ) {
            $title = get_the_title( $page['id'] ); $fk = get_post_meta( $page['id'], 'rank_math_focus_keyword', true ) ?: $title;
            $gen = self::ai( "Generate 3 SEO H2 headings for page '{$title}' keyword '{$fk}' for {$client['niche']} in {$client['city']}, {$client['state']}. One per line, no numbering." );
            if ( $gen ) {
                $lines = array_filter( array_map( 'trim', explode( "\n", $gen ) ) );
                $h2 = implode( '', array_map( fn( $l ) => "<h2>{$l}</h2>", $lines ) );
                $c = get_post_field( 'post_content', $page['id'] );
                $nc = preg_match( '/<h2/i', $c ) ? $h2 . preg_replace( '/<h2[^>]*>.*?<\/h2>/is', '', $c, 3 ) : $h2 . $c;
                wp_update_post( [ 'ID' => $page['id'], 'post_content' => $nc ] );
                $updated++; $results[] = [ 'id' => $page['id'], 'headings' => array_values( $lines ), 'status' => 'updated' ];
            } else { $errors++; $results[] = [ 'id' => $page['id'], 'status' => 'error' ]; }
        }
        return [ 'updated' => $updated, 'errors' => $errors, 'results' => $results ];
    }
}
